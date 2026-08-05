"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type TimeEntry = {
  id: string;
  user_id: string;
  project: string;
  task: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

const supabase = createClient();

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Local calendar day key (YYYY-MM-DD). Using toISOString() here would bucket
// entries by UTC day, so an evening entry west of UTC would land on tomorrow.
function localDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(from: Date) {
  const d = new Date(from);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(dateKey: string) {
  const today = new Date();
  const todayKey = localDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDayKey(yesterday);

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";

  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function TimeTrackerPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [project, setProject] = useState("");
  const [task, setTask] = useState("");
  const [starting, setStarting] = useState(false);

  const [now, setNow] = useState(() => Date.now());

  const loadEntries = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .order("started_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setEntries((data ?? []) as TimeEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      await loadEntries();
    })();
  }, [loadEntries]);

  const runningEntry = useMemo(() => entries.find((e) => e.ended_at === null) ?? null, [entries]);

  useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!project.trim() || !task.trim() || runningEntry) return;
    if (!userId) {
      setError("You need to be signed in to start a timer.");
      return;
    }
    setStarting(true);
    setError(null);

    const { error: insertError } = await supabase.from("time_entries").insert({
      user_id: userId,
      project: project.trim(),
      task: task.trim(),
      started_at: new Date().toISOString(),
      ended_at: null,
    });

    if (insertError) {
      setError(insertError.message);
      setStarting(false);
      return;
    }

    setProject("");
    setTask("");
    setStarting(false);
    await loadEntries();
  }

  async function handleStop(id: string) {
    const endedAt = new Date().toISOString();
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ended_at: endedAt } : e)));
    const { error: updateError } = await supabase.from("time_entries").update({ ended_at: endedAt }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      await loadEntries();
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error: deleteError } = await supabase.from("time_entries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      await loadEntries();
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const entry of entries) {
      const key = localDayKey(new Date(entry.started_at));
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const durationOf = useCallback(
    (entry: TimeEntry) => {
      const start = new Date(entry.started_at).getTime();
      const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
      return Math.max(0, end - start);
    },
    [now],
  );

  const week = useMemo(() => {
    const weekStart = startOfWeek(new Date()).getTime();
    const byProject = new Map<string, number>();
    let total = 0;
    for (const entry of entries) {
      if (new Date(entry.started_at).getTime() < weekStart) continue;
      const ms = durationOf(entry);
      total += ms;
      byProject.set(entry.project, (byProject.get(entry.project) ?? 0) + ms);
    }
    return {
      total,
      projects: Array.from(byProject.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [entries, durationOf]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Time Tracker</h1>
      <p className="mt-1 text-sm text-muted">
        Track time per project and task with a start/stop timer. One timer runs at a time, and it keeps
        running until you stop it — closing the tab won&apos;t end it.
      </p>

      <div className="card animate-fade-in mt-6 p-4">
        {runningEntry ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {runningEntry.project} <span className="text-muted">— {runningEntry.task}</span>
              </p>
              <p className="mt-1 font-mono text-2xl tabular-nums text-accent">
                {formatDuration(durationOf(runningEntry))}
              </p>
            </div>
            <button onClick={() => handleStop(runningEntry.id)} className="btn btn-secondary shrink-0">
              Stop
            </button>
          </div>
        ) : (
          <form onSubmit={handleStart} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="project" className="mb-1 block text-xs text-muted">
                Project
              </label>
              <input
                id="project"
                className="input w-full"
                placeholder="e.g. Client Website"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label htmlFor="task" className="mb-1 block text-xs text-muted">
                Task
              </label>
              <input
                id="task"
                className="input w-full"
                placeholder="e.g. Homepage redesign"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary shrink-0"
              disabled={starting || !project.trim() || !task.trim()}
            >
              {starting ? "Starting…" : "Start"}
            </button>
          </form>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No time entries yet. Start a timer above to begin tracking.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {week.total > 0 && (
            <div className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">This week</h2>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {formatDuration(week.total)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">Since Monday, in your local timezone.</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {week.projects.map(([projectName, ms]) => (
                  <li key={projectName} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate text-muted">{projectName}</span>
                    <span className="shrink-0 font-mono tabular-nums text-foreground">
                      {formatDuration(ms)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {groups.map(([dateKey, dayEntries]) => {
            const dayTotalMs = dayEntries.reduce((sum, e) => sum + durationOf(e), 0);
            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">{dayLabel(dateKey)}</h2>
                  <span className="font-mono text-xs text-muted">{formatDuration(dayTotalMs)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {dayEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      className="card animate-fade-in flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entry.project} <span className="text-muted">— {entry.task}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(entry.started_at).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {entry.ended_at
                            ? new Date(entry.ended_at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "running"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {formatDuration(durationOf(entry))}
                        </span>
                        {entry.ended_at === null && (
                          <button onClick={() => handleStop(entry.id)} className="btn btn-secondary text-xs">
                            Stop
                          </button>
                        )}
                        <button onClick={() => handleDelete(entry.id)} className="btn btn-secondary text-xs text-danger">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
