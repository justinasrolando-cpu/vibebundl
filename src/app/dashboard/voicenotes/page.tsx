"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ToolIcon from "@/components/ToolIcon";

type VoiceNote = {
  id: string;
  user_id: string;
  // Both are `not null default ''` in the schema — empty string, never null.
  title: string;
  transcript: string;
  created_at: string;
};

// Minimal shape of the Web Speech API we rely on — not in lib.dom.d.ts.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VoiceNotesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState(""); // finalized text only, editable
  const [interimText, setInterimText] = useState(""); // in-progress, not yet final
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supported, setSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTranscriptRef = useRef(""); // committed text before current listening session
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const loadNotes = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("voice_notes")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setNotes((data ?? []) as VoiceNote[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setLoadError("You are signed out. Sign in again to see your notes.");
        setLoading(false);
        return;
      }
      await loadNotes(user.id);
    })();
  }, [supabase, loadNotes]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setMicError(null);
    baseTranscriptRef.current = transcript ? transcript.replace(/\s+$/, "") + " " : "";

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += text + " ";
        } else {
          interimChunk += text;
        }
      }
      if (finalChunk) {
        baseTranscriptRef.current = baseTranscriptRef.current + finalChunk;
        setTranscript(baseTranscriptRef.current);
      }
      setInterimText(interimChunk);
    };

    recognition.onerror = (event) => {
      setMicError(event.error ?? "Microphone error");
      setListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopDictation = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggleDictation = () => {
    if (listening) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  const resetEditor = () => {
    if (listening) stopDictation();
    setSelectedId(null);
    setTitle("");
    setTranscript("");
    setInterimText("");
    baseTranscriptRef.current = "";
    setMicError(null);
    setActionError(null);
  };

  const handleSave = async () => {
    if (!transcript.trim()) return;
    if (!userId) {
      setActionError("You are signed out. Sign in again to save notes.");
      return;
    }
    setActionError(null);
    setSaving(true);
    if (listening) stopDictation();

    if (selectedId) {
      const { data, error } = await supabase
        .from("voice_notes")
        .update({
          title: title.trim() || "Untitled note",
          transcript: transcript.trim(),
        })
        .eq("id", selectedId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) {
        setActionError(error?.message ?? "Could not save this note.");
      } else {
        setNotes((prev) => prev.map((n) => (n.id === selectedId ? (data as VoiceNote) : n)));
      }
    } else {
      const { data, error } = await supabase
        .from("voice_notes")
        .insert({
          user_id: userId,
          title: title.trim() || "Untitled note",
          transcript: transcript.trim(),
        })
        .select()
        .single();
      if (error || !data) {
        setActionError(error?.message ?? "Could not save this note.");
      } else {
        setNotes((prev) => [data as VoiceNote, ...prev]);
        setSelectedId((data as VoiceNote).id);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (note: VoiceNote) => {
    if (!userId) return;
    if (!confirm(`Delete "${note.title || "Untitled note"}"? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("voice_notes")
      .delete()
      .eq("id", note.id)
      .eq("user_id", userId);
    if (error) {
      setActionError(error.message);
      return;
    }
    setActionError(null);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (selectedId === note.id) resetEditor();
  };

  const loadIntoEditor = (note: VoiceNote) => {
    if (listening) stopDictation();
    setSelectedId(note.id);
    setTitle(note.title ?? "");
    setTranscript(note.transcript ?? "");
    setInterimText("");
    baseTranscriptRef.current = note.transcript ? note.transcript.replace(/\s+$/, "") + " " : "";
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Voice Notes</h1>
        <p className="text-sm text-muted">
          Dictate straight to text. Hit the mic, talk, hit it again to stop — then hand-edit
          the result. No AI summary here, just fast capture.
        </p>
      </div>

      <div className="card flex flex-col items-center gap-4 p-8">
        <button
          onClick={toggleDictation}
          disabled={!supported}
          className={`flex h-24 w-24 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-95 ${
            listening
              ? "animate-pulse bg-danger text-white shadow-lg shadow-danger/30"
              : "bg-accent text-white hover:brightness-110"
          } ${!supported ? "cursor-not-allowed opacity-40" : ""}`}
          aria-label={listening ? "Stop dictating" : "Start dictating"}
        >
          {listening ? (
            <span className="h-6 w-6 rounded-[4px] bg-current" />
          ) : (
            <ToolIcon slug="voicenotes" size={34} />
          )}
        </button>
        <p className="text-sm font-medium">
          {!supported
            ? "Speech recognition isn't supported in this browser"
            : listening
              ? "Listening… tap to stop"
              : "Tap to start dictating"}
        </p>
        {micError && <p className="text-sm text-danger">Mic error: {micError}</p>}
        {!supported && (
          <p className="max-w-sm text-center text-xs text-muted">
            Try Chrome or Edge for live dictation. You can still type or paste text below and
            save it as a note.
          </p>
        )}
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <input
            className="input w-full"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {selectedId && (
            <button className="btn btn-secondary shrink-0 text-xs" onClick={resetEditor}>
              + New
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          className="input min-h-[180px] w-full resize-y font-mono text-sm leading-relaxed"
          placeholder="Your transcript appears here as you speak — or just type."
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            baseTranscriptRef.current = e.target.value;
          }}
        />
        {interimText && (
          <p className="-mt-1 rounded-md border border-dashed border-border bg-surface px-3 py-2 font-mono text-sm italic leading-relaxed text-muted">
            {interimText}
          </p>
        )}
        {actionError && <p className="text-sm text-danger">{actionError}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : "Empty"}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !transcript.trim()}
          >
            {saving ? "Saving…" : selectedId ? "Save changes" : "Save note"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Past notes</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : notes.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            No voice notes yet. Dictate something above and save it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className={`animate-fade-in card flex items-start justify-between gap-3 p-3 ${
                  note.id === selectedId ? "bg-surface-hover" : ""
                }`}
              >
                <button onClick={() => loadIntoEditor(note)} className="flex-1 text-left">
                  <p className="truncate text-sm font-medium">{note.title || "Untitled note"}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {note.transcript || "No content"}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(note.created_at)}</p>
                </button>
                <button
                  onClick={() => handleDelete(note)}
                  className="btn btn-secondary shrink-0 text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
