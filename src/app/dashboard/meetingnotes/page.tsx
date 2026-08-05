"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MeetingNote = {
  id: string;
  user_id: string;
  title: string;
  transcript: string;
  // `summary` is `not null default ''` in the schema — never null, just empty.
  summary: string;
  recorded_at: string;
  created_at: string;
};

// Minimal shape of the Web Speech API's SpeechRecognition — not in TS lib.dom yet.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

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
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MeetingNotesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [speechSupported, setSpeechSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTranscriptRef = useRef("");

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const loadMeetings = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("meeting_notes")
        .select("*")
        .eq("user_id", uid)
        .order("recorded_at", { ascending: false });
      if (err) {
        setLoadError(err.message);
      } else {
        setLoadError(null);
        setMeetings((data ?? []) as MeetingNote[]);
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
        setLoadError("You are signed out. Sign in again to see your meetings.");
        setLoading(false);
        return;
      }
      await loadMeetings(user.id);
    })();
  }, [supabase, loadMeetings]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleStart = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      return;
    }
    setError(null);
    setSummary("");
    setSelectedId(null);
    if (!recordedAt) setRecordedAt(new Date().toISOString());

    baseTranscriptRef.current = transcript ? transcript.trim() + " " : "";

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
      }
      setTranscript(baseTranscriptRef.current + interimChunk);
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  const handleStop = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const handleSummarize = async () => {
    if (!transcript.trim()) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/meetingnotes/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to summarize.");
      }
      setSummary(data.summary as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to summarize.");
    } finally {
      setSummarizing(false);
    }
  };

  const handleSave = async () => {
    if (!transcript.trim()) return;
    if (!userId) {
      setError("You are signed out. Sign in again to save this meeting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("meeting_notes")
        .insert({
          user_id: userId,
          title: title.trim() || "Untitled meeting",
          transcript,
          // `summary` is NOT NULL: send "" when there is no summary, never null.
          summary,
          recorded_at: recordedAt ?? new Date().toISOString(),
        })
        .select()
        .single();
      if (err) throw err;
      setMeetings((prev) =>
        [data as MeetingNote, ...prev].sort(
          (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
        ),
      );
      // Reset composer for a fresh meeting
      setTitle("");
      setTranscript("");
      setSummary("");
      setRecordedAt(null);
      baseTranscriptRef.current = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save meeting.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    const { error: err } = await supabase.from("meeting_notes").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Meeting Notes</h1>
        <p className="mt-1 text-sm text-muted">
          Record a live transcript while you talk, then generate an AI summary with key points,
          decisions, and action items.
        </p>
        <p className="mt-1 text-xs text-muted-2">
          Transcription uses your browser&apos;s speech recognition, so it hears your microphone
          only — not the other people on a video call. For those, put this device&apos;s mic near
          the speaker or paste a transcript in by hand. No calendar or meeting-app integration.
        </p>
      </div>

      <div className="card animate-fade-in flex flex-col gap-4 p-5">
        {!speechSupported && (
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
            Live dictation needs Chrome or Edge on this device. You can still paste or type a
            transcript manually below.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {speechSupported && !recording && (
            <button className="btn btn-primary text-sm" onClick={handleStart}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />
              Start recording
            </button>
          )}
          {speechSupported && recording && (
            <button className="btn btn-secondary text-sm text-danger" onClick={handleStop}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-current" />
              Stop
            </button>
          )}
          {recording && (
            <span className="flex items-center gap-1.5 text-xs text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              Listening…
            </span>
          )}
        </div>

        <input
          className="input w-full"
          placeholder="Meeting title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="input min-h-[220px] w-full resize-y text-sm leading-relaxed"
          placeholder="Transcript will appear here as you talk — or paste/type one manually…"
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            baseTranscriptRef.current = e.target.value;
          }}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-secondary text-sm"
            onClick={handleSummarize}
            disabled={!transcript.trim() || summarizing}
          >
            {summarizing ? "Summarizing…" : "Summarize"}
          </button>
          <button
            className="btn btn-primary text-sm"
            onClick={handleSave}
            disabled={!transcript.trim() || saving}
          >
            {saving ? "Saving…" : "Save meeting"}
          </button>
        </div>

        {summary && (
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="mb-1 text-xs font-medium text-muted">Summary</p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{summary}</pre>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted">Past meetings</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : meetings.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            No meetings saved yet. Record or paste a transcript above to get started.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {meetings.map((m) => (
              <li key={m.id} className="card animate-fade-in overflow-hidden">
                <button
                  className="flex w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-surface-hover"
                  onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{m.title || "Untitled meeting"}</p>
                    <span className="shrink-0 text-xs text-muted">{formatDate(m.recorded_at)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {(m.summary || m.transcript || "No content").slice(0, 140)}
                  </p>
                </button>

                {selectedId === m.id && (
                  <div className="flex flex-col gap-3 border-t border-border p-4">
                    {m.summary && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">Summary</p>
                        <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface p-3 font-sans text-sm leading-relaxed">
                          {m.summary}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">Transcript</p>
                      <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 font-sans text-sm leading-relaxed">
                        {m.transcript}
                      </pre>
                    </div>
                    <div>
                      <button
                        className="btn btn-secondary text-xs text-danger"
                        onClick={() => handleDelete(m.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
