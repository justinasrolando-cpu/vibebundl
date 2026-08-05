"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Snippet = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function TtsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [playingSnippetId, setPlayingSnippetId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const loadSnippets = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tts_snippets")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setSnippets((data ?? []) as Snippet[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setLoadError("You are signed out. Sign in again to see your saved snippets.");
        setLoading(false);
        return;
      }
      await loadSnippets(user.id);
    })();
  }, [supabase, loadSnippets]);

  // Load voices, handling browsers that populate the list asynchronously.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const populate = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        setVoices(list);
        setVoiceURI((prev) => prev || list[0].voiceURI);
      }
    };
    populate();
    window.speechSynthesis.addEventListener("voiceschanged", populate);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", populate);
    };
  }, []);

  // Stop any speech when navigating away from the page.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Chrome silently cuts speechSynthesis off after roughly 15 seconds, so
  // anything longer than a short paragraph stops mid-sentence with no error.
  // Nudging pause()/resume() on a timer keeps the utterance alive.
  useEffect(() => {
    if (!speaking || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const id = window.setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => window.clearInterval(id);
  }, [speaking]);

  const speak = useCallback(
    (value: string, onEnd?: () => void) => {
      if (!supported || !value.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(value);
      const voice = voices.find((v) => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onend = () => {
        setSpeaking(false);
        setPlayingSnippetId(null);
        onEnd?.();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setPlayingSnippetId(null);
        onEnd?.();
      };
      utteranceRef.current = utterance;
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported, voices, voiceURI, rate, pitch],
  );

  const handleSpeak = () => speak(text);

  const handleStop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPlayingSnippetId(null);
  };

  const handlePlaySnippet = (snippet: Snippet) => {
    setPlayingSnippetId(snippet.id);
    speak(snippet.text, () => setPlayingSnippetId(null));
  };

  const handleSaveSnippet = async () => {
    if (!text.trim()) return;
    if (!userId) {
      setActionError("You are signed out. Sign in again to save snippets.");
      return;
    }
    setActionError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("tts_snippets")
      .insert({ user_id: userId, text: text.trim() })
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not save this snippet.");
    } else {
      setSnippets((prev) => [data as Snippet, ...prev]);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("tts_snippets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      setActionError(error.message);
      return;
    }
    setActionError(null);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    if (playingSnippetId === id) handleStop();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Speech</h1>
        <p className="mt-1 text-sm text-muted">
          Reads text aloud using your browser&apos;s built-in voices. This is a free, budget
          substitute for a paid TTS service &mdash; voice quality and selection depend entirely on
          your OS and browser, not on us.
        </p>
      </div>

      {!supported ? (
        <div className="card p-4 text-sm text-danger">
          Your browser doesn&apos;t support the Web Speech API (speechSynthesis). Try Chrome,
          Edge, or Safari.
        </div>
      ) : (
        <div className="card animate-fade-in flex flex-col gap-4 p-4">
          <textarea
            className="input min-h-[140px] w-full resize-y text-sm leading-relaxed"
            placeholder="Type or paste the text you want spoken…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Voice</label>
              <select
                className="input w-full"
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
              >
                {voices.length === 0 && <option value="">Loading voices…</option>}
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-muted">Rate: {rate.toFixed(1)}</label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-muted">Pitch: {pitch.toFixed(1)}</label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>

          {actionError && <p className="text-sm text-danger">{actionError}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary text-sm"
              onClick={handleSpeak}
              disabled={!text.trim() || speaking}
            >
              {speaking && !playingSnippetId ? "Speaking…" : "Speak"}
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={handleStop}
              disabled={!speaking}
            >
              Stop
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={handleSaveSnippet}
              disabled={!text.trim() || saving || !userId}
            >
              {saving ? "Saving…" : "Save snippet"}
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Saved snippets</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : snippets.length === 0 ? (
          <div className="card p-4 text-sm text-muted">
            No saved snippets yet. Write something above and click &quot;Save snippet&quot; to
            keep it here for quick replay.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {snippets.map((s) => (
              <li
                key={s.id}
                className="card animate-fade-in flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-sm">{s.text}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(s.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="btn btn-secondary text-xs"
                    onClick={() =>
                      playingSnippetId === s.id ? handleStop() : handlePlaySnippet(s)
                    }
                    disabled={!supported}
                  >
                    {playingSnippetId === s.id ? "Stop" : "Play"}
                  </button>
                  <button
                    className="btn btn-secondary text-xs text-danger"
                    onClick={() => handleDelete(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
