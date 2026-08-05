"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FocusSession = {
  id: string;
  user_id: string;
  label: string;
  minutes: number;
  completed_at: string;
};

const PRESETS = [25, 50, 15, 5];
const MAX_MINUTES = 240;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

/** Local (not UTC) YYYY-MM-DD key for a timestamptz string. */
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key: string) {
  const today = new Date();
  const todayStr = todayKey();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  if (key === todayStr) return "Today";
  if (key === yesterdayStr) return "Yesterday";
  return new Date(key + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTimeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Short two-tone chime via the Web Audio API — no audio file, no dependency. */
function playChime() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const start = ctx.currentTime + 0.02;
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.26;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Audio is a nice-to-have; the on-screen completion state is the real signal.
  }
}

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function FocusPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [durationMin, setDurationMin] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("");
  const [justCompleted, setJustCompleted] = useState<{ minutes: number; label: string } | null>(null);

  const endAtRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  const loadSessions = useCallback(
    async (uid: string) => {
      setLoadError(null);
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("*")
        .eq("user_id", uid)
        .order("completed_at", { ascending: false })
        .limit(300);

      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      setSessions((data ?? []) as FocusSession[]);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setLoading(false);
        setLoadError("You need to be signed in to track focus sessions.");
        return;
      }
      setUserId(user.id);
      await loadSessions(user.id);
    })();
    return () => {
      active = false;
    };
  }, [supabase, loadSessions]);

  // Record a finished session.
  const recordSession = useCallback(
    async (minutes: number, sessionLabel: string) => {
      if (!userId) {
        setSaveError("Session finished but could not be saved — you appear to be signed out.");
        return;
      }
      setSaving(true);
      setSaveError(null);
      const { data, error } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: userId,
          label: sessionLabel,
          minutes,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        setSaveError(`Session finished but could not be saved: ${error.message}`);
      } else if (data) {
        setSessions((prev) => [data as FocusSession, ...prev]);
      }
      setSaving(false);
    },
    [supabase, userId],
  );

  const finish = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    endAtRef.current = null;
    setRunning(false);
    setRemaining(0);
    const done = { minutes: durationMin, label: label.trim() };
    setJustCompleted(done);
    playChime();
    void recordSession(done.minutes, done.label);
  }, [durationMin, label, recordSession]);

  // Deadline-based ticking so the countdown stays accurate even if the tab throttles.
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const end = endAtRef.current;
      if (end === null) return;
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finish();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  // Mirror the countdown in the tab title while a session is running.
  useEffect(() => {
    if (!running) return;
    const previous = document.title;
    document.title = `${formatClock(remaining)} · Focus`;
    return () => {
      document.title = previous;
    };
  }, [running, remaining]);

  const start = () => {
    if (remaining <= 0) return;
    completingRef.current = false;
    setJustCompleted(null);
    setSaveError(null);
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const pause = () => {
    const end = endAtRef.current;
    if (end !== null) setRemaining(Math.max(0, Math.round((end - Date.now()) / 1000)));
    endAtRef.current = null;
    setRunning(false);
  };

  const reset = useCallback(
    (minutes = durationMin) => {
      completingRef.current = false;
      endAtRef.current = null;
      setRunning(false);
      setRemaining(minutes * 60);
      setJustCompleted(null);
    },
    [durationMin],
  );

  const choosePreset = (minutes: number) => {
    setDurationMin(minutes);
    reset(minutes);
  };

  const handleCustomMinutes = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(MAX_MINUTES, Math.max(1, Math.round(parsed)));
    setDurationMin(clamped);
    reset(clamped);
  };

  const handleDelete = async (session: FocusSession) => {
    setDeleteError(null);
    const previous = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    const { error } = await supabase
      .from("focus_sessions")
      .delete()
      .eq("id", session.id)
      .eq("user_id", session.user_id);
    if (error) {
      setSessions(previous);
      setDeleteError(error.message);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, FocusSession[]>();
    for (const s of sessions) {
      const key = dayKey(s.completed_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [sessions]);

  const today = todayKey();
  const todaySessions = useMemo(
    () => sessions.filter((s) => dayKey(s.completed_at) === today),
    [sessions, today],
  );
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  const totalSeconds = Math.max(1, durationMin * 60);
  const progress = Math.min(1, Math.max(0, remaining / totalSeconds));
  const idleAtFull = !running && remaining === durationMin * 60;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <div>
        <h1 className="text-lg font-semibold">Focus Timer</h1>
        <p className="mt-1 text-sm text-muted">
          {todaySessions.length === 0
            ? "No sessions logged today yet."
            : `${todaySessions.length} session${todaySessions.length === 1 ? "" : "s"} · ${formatDuration(todayMinutes)} focused today`}
        </p>
      </div>

      {/* Timer */}
      <div className="card mt-5 flex flex-col items-center gap-5 p-6">
        <div className="relative h-52 w-52">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
            />
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight">
              {formatClock(remaining)}
            </span>
            <span className="mt-1 text-xs uppercase tracking-wide text-muted">
              {running ? "Focusing" : remaining === 0 ? "Done" : idleAtFull ? `${durationMin} min` : "Paused"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => choosePreset(m)}
              disabled={running}
              className={`btn text-sm ${durationMin === m ? "btn-primary" : "btn-secondary"}`}
            >
              {m} min
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span>Custom</span>
            <input
              type="number"
              min={1}
              max={MAX_MINUTES}
              value={durationMin}
              disabled={running}
              onChange={(e) => handleCustomMinutes(e.target.value)}
              className="input w-16 text-sm"
              aria-label="Custom duration in minutes"
            />
          </label>
        </div>
        <p className="-mt-2 text-center text-xs text-muted-2">
          The countdown runs in this tab only — a session is logged when it reaches zero, so
          closing or reloading the tab mid-session loses it.
        </p>

        <input
          className="input w-full max-w-sm text-center"
          placeholder="What are you working on? (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
        />

        <div className="flex items-center gap-2">
          {running ? (
            <button type="button" onClick={pause} className="btn btn-secondary text-sm">
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="btn btn-primary text-sm"
              disabled={remaining <= 0}
            >
              {idleAtFull || remaining <= 0 ? "Start" : "Resume"}
            </button>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-secondary text-sm"
            disabled={idleAtFull}
          >
            Reset
          </button>
        </div>

        {justCompleted && (
          <div className="animate-fade-in w-full rounded-lg border border-accent/40 bg-accent/10 p-4 text-center">
            <p className="text-sm font-medium text-accent">
              Session complete — {formatDuration(justCompleted.minutes)} focused.
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {justCompleted.label ? `“${justCompleted.label}”` : "No label"} ·{" "}
              {saving ? "Saving…" : saveError ? "Not saved" : "Logged below"}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="btn btn-primary mt-3 text-sm"
            >
              Start another
            </button>
          </div>
        )}

        {saveError && <p className="text-sm text-danger">{saveError}</p>}
      </div>

      {/* Today summary */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Focused today</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {formatDuration(todayMinutes)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Sessions today</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{todaySessions.length}</p>
        </div>
      </div>

      {/* History */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold">Recent sessions</h2>
        {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
        {loadError && <p className="mt-2 text-sm text-danger">{loadError}</p>}

        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No sessions yet. Pick a duration, hit Start, and your first finished session will show up here.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-5">
            {grouped.map(([key, daySessions]) => {
              const dayMinutes = daySessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {dayLabel(key)}
                    </h3>
                    <span className="text-xs text-muted">
                      {daySessions.length} · {formatDuration(dayMinutes)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {daySessions.map((s) => (
                      <li key={s.id} className="card animate-fade-in flex items-center gap-3 p-3">
                        <span className="font-mono text-sm tabular-nums text-accent">
                          {s.minutes}m
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {s.label || <span className="text-muted">Untitled session</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {formatTimeOfDay(s.completed_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          aria-label="Delete session"
                          className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:text-danger"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
