"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type WorkoutEntry = {
  id: string;
  user_id: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  logged_at: string;
  created_at: string;
};

const COMMON_EXERCISES = [
  "Bench Press",
  "Squat",
  "Deadlift",
  "Overhead Press",
  "Pull-up",
  "Barbell Row",
  "Lat Pulldown",
  "Bicep Curl",
];

// Local calendar day (YYYY-MM-DD). toISOString() would return the UTC day, which
// is tomorrow's date for anyone west of UTC during their evening.
function localDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return localDayKey(new Date());
}

function dayLabel(dateKey: string) {
  const today = new Date();
  const todayStr = localDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDayKey(yesterday);

  if (dateKey === todayStr) return "Today";
  if (dateKey === yesterdayStr) return "Yesterday";

  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

// numeric/int columns can arrive as strings depending on the driver; coerce once
// so comparisons and volume maths never run on strings.
function normalizeEntry(row: WorkoutEntry): WorkoutEntry {
  return {
    ...row,
    sets: Number(row.sets) || 0,
    reps: Number(row.reps) || 0,
    weight: Number(row.weight) || 0,
  };
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = date.getDate() - day;
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function WorkoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [loggedAt, setLoggedAt] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("workout_entries")
      .select("*")
      .order("logged_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setEntries(((data ?? []) as WorkoutEntry[]).map(normalizeEntry));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadEntries();
    })();
  }, [supabase, loadEntries]);

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutEntry[]>();
    for (const e of entries) {
      const key = e.logged_at;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const weeklyVolume = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    let total = 0;
    for (const e of entries) {
      const d = new Date(e.logged_at + "T00:00:00");
      if (d >= weekStart) {
        total += (e.sets || 0) * (e.reps || 0) * (e.weight || 0);
      }
    }
    return total;
  }, [entries]);

  // Best weight per exercise, plus how many entries that exercise has — a single
  // entry is not a "best", so only mark once there is something to beat.
  const bestWeights = useMemo(() => {
    const map = new Map<string, { best: number; count: number }>();
    for (const e of entries) {
      const current = map.get(e.exercise);
      if (!current) map.set(e.exercise, { best: e.weight, count: 1 });
      else map.set(e.exercise, { best: Math.max(current.best, e.weight), count: current.count + 1 });
    }
    return map;
  }, [entries]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise.trim()) return;
    if (!userId) {
      setError("You need to be signed in to log a workout.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      user_id: userId,
      exercise: exercise.trim(),
      sets: Math.max(1, parseInt(sets, 10) || 1),
      reps: Math.max(1, parseInt(reps, 10) || 1),
      weight: Math.max(0, parseFloat(weight) || 0),
      logged_at: loggedAt || todayKey(),
    };

    const { data, error: insertError } = await supabase
      .from("workout_entries")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (data) {
      setEntries((prev) => [normalizeEntry(data as WorkoutEntry), ...prev]);
    }

    setExercise("");
    setSets("3");
    setReps("10");
    setWeight("0");
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id));
    const { error: deleteError } = await supabase.from("workout_entries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      setEntries(prev);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Workout Log</h1>
        <p className="text-sm text-muted">
          Log sets, reps, and weight per exercise, browse by day. Weight is unit-less — pick kg or lb and
          stay consistent. Manual logging only; there is no watch or app sync.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="exercise">
              Exercise
            </label>
            <input
              id="exercise"
              className="input w-full"
              placeholder="e.g. Bench Press"
              list="common-exercises"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              required
            />
            <datalist id="common-exercises">
              {COMMON_EXERCISES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="sets">
              Sets
            </label>
            <input
              id="sets"
              type="number"
              min={1}
              className="input w-full"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="reps">
              Reps
            </label>
            <input
              id="reps"
              type="number"
              min={1}
              className="input w-full"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="weight">
              Weight
            </label>
            <input
              id="weight"
              type="number"
              min={0}
              step="0.5"
              className="input w-full"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="logged_at">
              Date
            </label>
            <input
              id="logged_at"
              type="date"
              className="input w-full"
              value={loggedAt}
              onChange={(e) => setLoggedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {weeklyVolume > 0 ? (
            <span className="text-xs text-muted">
              Volume this week (sets × reps × weight):{" "}
              <span className="tabular-nums text-foreground">{weeklyVolume.toLocaleString()}</span>
            </span>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary text-sm" disabled={saving || !exercise.trim()}>
            {saving ? "Adding…" : "+ Add entry"}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">No workouts logged yet. Add your first set above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([dateKey, dayEntries]) => (
            <div key={dateKey} className="animate-fade-in flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted">{dayLabel(dateKey)}</h2>
              <div className="card divide-y divide-border p-0">
                {dayEntries.map((entry) => {
                  const stat = bestWeights.get(entry.exercise);
                  const isBest =
                    entry.weight > 0 && !!stat && stat.count > 1 && stat.best === entry.weight;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{entry.exercise}</span>
                        <span className="text-xs text-muted">
                          {entry.sets} × {entry.reps} @ {entry.weight}
                          {isBest && (
                            <span className="ml-2 text-accent">best</span>
                          )}
                        </span>
                      </div>
                      <button
                        className="btn btn-secondary text-xs text-danger shrink-0"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
