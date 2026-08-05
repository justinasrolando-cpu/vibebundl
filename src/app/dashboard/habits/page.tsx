"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Habit = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

type Checkin = {
  id: string;
  habit_id: string;
  done_on: string;
  created_at: string;
};

const PRESET_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#f87171",
];

/** Local (not UTC) YYYY-MM-DD key, so "today" matches the user's calendar. */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Consecutive days ending today, or ending yesterday if today isn't done yet. */
function currentStreak(done: Set<string>, today: Date): number {
  let cursor: Date;
  if (done.has(dateKey(today))) {
    cursor = today;
  } else if (done.has(dateKey(addDays(today, -1)))) {
    cursor = addDays(today, -1);
  } else {
    return 0;
  }
  let count = 0;
  while (done.has(dateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export default function HabitsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  // Anchor "today" so every row agrees on the same 7-day window. Re-anchored
  // when the tab is refocused so a page left open overnight rolls over.
  const [today, setToday] = useState<Date>(() => new Date());
  const todayKey = useMemo(() => dateKey(today), [today]);

  useEffect(() => {
    const resync = () => {
      const now = new Date();
      setToday((prev) => (dateKey(prev) === dateKey(now) ? prev : now));
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        return {
          key: dateKey(d),
          letter: d.toLocaleDateString(undefined, { weekday: "narrow" }),
          label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        };
      }),
    [today],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("You need to be signed in to track habits.");
      return;
    }
    setUserId(user.id);

    const { data: habitRows, error: habitError } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (habitError) {
      setError(habitError.message);
      setLoading(false);
      return;
    }

    const list = (habitRows ?? []) as Habit[];
    setHabits(list);

    if (list.length === 0) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    const { data: checkinRows, error: checkinError } = await supabase
      .from("habit_checkins")
      .select("*")
      .in(
        "habit_id",
        list.map((h) => h.id),
      )
      .order("done_on", { ascending: false });

    if (checkinError) {
      setError(checkinError.message);
      setLoading(false);
      return;
    }

    setCheckins((checkinRows ?? []) as Checkin[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const doneByHabit = useMemo(() => {
    const map = new Map<string, Map<string, string>>(); // habit_id -> done_on -> checkin id
    for (const c of checkins) {
      let inner = map.get(c.habit_id);
      if (!inner) {
        inner = new Map<string, string>();
        map.set(c.habit_id, inner);
      }
      inner.set(c.done_on, c.id);
    }
    return map;
  }, [checkins]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setAdding(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("habits")
      .insert({ user_id: userId, name: name.trim(), color })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setAdding(false);
      return;
    }

    if (data) setHabits((prev) => [...prev, data as Habit]);
    setName("");
    setColor(PRESET_COLORS[0]);
    setAdding(false);
  };

  const toggleToday = async (habit: Habit) => {
    if (pending === habit.id) return;
    setError(null);
    setPending(habit.id);

    const existingId = doneByHabit.get(habit.id)?.get(todayKey);

    if (existingId) {
      const snapshot = checkins;
      setCheckins((prev) => prev.filter((c) => c.id !== existingId));
      const { error: deleteError } = await supabase
        .from("habit_checkins")
        .delete()
        .eq("id", existingId);
      if (deleteError) {
        setCheckins(snapshot);
        setError(deleteError.message);
      }
      setPending(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("habit_checkins")
      .insert({ habit_id: habit.id, done_on: todayKey })
      .select()
      .single();

    if (insertError) {
      // 23505 = unique (habit_id, done_on) violation: another tab already
      // checked this off today. Not an error worth showing — just resync.
      if (insertError.code === "23505") {
        const { data: rows } = await supabase
          .from("habit_checkins")
          .select("*")
          .eq("habit_id", habit.id)
          .eq("done_on", todayKey);
        const row = (rows ?? [])[0] as Checkin | undefined;
        if (row) setCheckins((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
      } else {
        setError(insertError.message);
      }
      setPending(null);
      return;
    }

    if (data) setCheckins((prev) => [data as Checkin, ...prev]);
    setPending(null);
  };

  const handleDelete = async (habit: Habit) => {
    if (!window.confirm(`Delete "${habit.name}" and all of its check-ins?`)) return;
    setError(null);

    const habitSnapshot = habits;
    const checkinSnapshot = checkins;
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    setCheckins((prev) => prev.filter((c) => c.habit_id !== habit.id));

    const { error: deleteError } = await supabase.from("habits").delete().eq("id", habit.id);
    if (deleteError) {
      setHabits(habitSnapshot);
      setCheckins(checkinSnapshot);
      setError(deleteError.message);
    }
  };

  const doneToday = habits.filter((h) => doneByHabit.get(h.id)?.has(todayKey)).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-lg font-semibold">Habit Tracker</h1>
        <p className="mt-1 text-sm text-muted">
          {habits.length === 0
            ? "Check off daily habits and watch your streaks build."
            : `${doneToday} of ${habits.length} done today.`}
        </p>
        <p className="mt-0.5 text-xs text-muted-2">
          Manual tracking only — the last 7 days are shown, and only today&apos;s square can be
          checked or unchecked. No reminders or notifications.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input w-full"
            placeholder="New habit… (e.g. Read 20 pages)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Use color ${c}`}
                aria-pressed={color === c}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="submit"
            className="btn btn-primary shrink-0 text-sm"
            disabled={adding || !name.trim() || !userId}
          >
            {adding ? "Adding…" : "Add habit"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            No habits yet. Add one above, then tap today&apos;s square each day to build a streak.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1 text-xs uppercase tracking-wide text-muted/70">Habit</span>
            <span className="w-14 shrink-0 text-right text-xs uppercase tracking-wide text-muted/70">
              Streak
            </span>
            <div className="flex shrink-0 gap-1">
              {days.map((d) => (
                <span
                  key={d.key}
                  className={`w-6 text-center text-[10px] ${
                    d.key === todayKey ? "text-foreground" : "text-muted/70"
                  }`}
                >
                  {d.letter}
                </span>
              ))}
            </div>
            <span className="w-6 shrink-0" />
          </div>

          {habits.map((habit) => {
            const done = doneByHabit.get(habit.id) ?? new Map<string, string>();
            const streak = currentStreak(new Set(done.keys()), today);
            const isPending = pending === habit.id;

            return (
              <div key={habit.id} className="animate-fade-in flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="truncate text-sm">{habit.name}</span>
                </div>

                <span
                  className={`w-14 shrink-0 text-right text-sm tabular-nums ${
                    streak > 0 ? "text-foreground" : "text-muted"
                  }`}
                  title={streak > 0 ? `${streak}-day streak` : "No active streak"}
                >
                  {streak > 0 ? `${streak}d` : "—"}
                </span>

                <div className="flex shrink-0 gap-1">
                  {days.map((d) => {
                    const filled = done.has(d.key);
                    const isToday = d.key === todayKey;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        disabled={!isToday || isPending}
                        onClick={isToday ? () => toggleToday(habit) : undefined}
                        title={
                          isToday
                            ? filled
                              ? "Done today — click to undo"
                              : "Click to check off today"
                            : `${d.label}${filled ? " — done" : ""}`
                        }
                        aria-label={`${d.label}${filled ? ", done" : ", not done"}`}
                        className={`h-6 w-6 rounded-[5px] border transition-opacity ${
                          isToday ? "border-foreground/60" : "border-border"
                        } ${isToday && !isPending ? "cursor-pointer hover:opacity-80" : ""} ${
                          isPending && isToday ? "opacity-50" : ""
                        }`}
                        style={{ backgroundColor: filled ? habit.color : "transparent" }}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(habit)}
                  aria-label={`Delete ${habit.name}`}
                  className="w-6 shrink-0 rounded-md text-xs text-muted transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
