"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Priority = "low" | "normal" | "high";

type Task = {
  id: string;
  user_id: string;
  project: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: Priority;
  completed: boolean;
  created_at: string;
};

const DEFAULT_PROJECT = "Inbox";

const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-muted",
  normal: "bg-foreground",
  high: "bg-danger",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

function formatDueDate(due: string): string {
  // due_date is a plain date string (YYYY-MM-DD); parse without timezone shift.
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(due: string): boolean {
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

export default function TasksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Quick-add state
  const [title, setTitle] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTasks = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setTasks((data ?? []) as Task[]);
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
        setLoadError("You are signed out. Sign in again to see your tasks.");
        setLoading(false);
        return;
      }
      await loadTasks(user.id);
    })();
  }, [supabase, loadTasks]);

  const resetForm = () => {
    setTitle("");
    setProject(DEFAULT_PROJECT);
    setNotes("");
    setDueDate("");
    setPriority("normal");
    setShowDetails(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!userId) {
      setFormError("You are signed out. Sign in again to add tasks.");
      return;
    }
    setFormError(null);
    setAdding(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        project: project.trim() || DEFAULT_PROJECT,
        title: title.trim(),
        notes: notes.trim(),
        due_date: dueDate || null,
        priority,
        completed: false,
      })
      .select()
      .single();
    if (error || !data) {
      setFormError(error?.message ?? "Could not add that task. Try again.");
      setAdding(false);
      return;
    }
    setTasks((prev) => [...prev, data as Task]);
    resetForm();
    setAdding(false);
  };

  const toggleCompleted = async (task: Task) => {
    const next = !task.completed;
    setActionError(null);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    const { error } = await supabase.from("tasks").update({ completed: next }).eq("id", task.id);
    if (error) {
      // revert on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)));
      setActionError(`Could not update that task: ${error.message}`);
    }
  };

  const handleDelete = async (task: Task) => {
    setActionError(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      setTasks((prev) => [...prev, task]);
      setActionError(`Could not delete that task: ${error.message}`);
    }
  };

  const visibleTasks = useMemo(
    () => (showCompleted ? tasks : tasks.filter((t) => !t.completed)),
    [tasks, showCompleted],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of visibleTasks) {
      const key = t.project || DEFAULT_PROJECT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Sort each group: incomplete first (by created_at), then completed.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
    // Order groups with Inbox first, then alphabetically.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === DEFAULT_PROJECT) return -1;
      if (b === DEFAULT_PROJECT) return 1;
      return a.localeCompare(b);
    });
  }, [visibleTasks]);

  const openCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.length - openCount;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-muted">
            {openCount} open{completedCount > 0 ? ` · ${completedCount} done` : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Show completed
        </label>
      </div>

      <form onSubmit={handleAdd} className="card mt-5 flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <input
            className="input w-full"
            placeholder="Add a task… (e.g. Renew domain)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary shrink-0 text-sm" disabled={adding || !title.trim()}>
            Add
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="self-start text-xs text-muted transition-colors hover:text-foreground"
        >
          {showDetails ? "− Hide details" : "+ Add details"}
        </button>

        {showDetails && (
          <div className="animate-fade-in grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Project</span>
              <input
                className="input w-full text-sm"
                placeholder="Inbox"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Priority</span>
              <select
                className="input w-full text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Due date</span>
              <input
                type="date"
                className="input w-full text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-muted">Notes</span>
              <textarea
                className="input w-full min-h-[70px] resize-y text-sm"
                placeholder="Optional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {formError && <p className="text-sm text-danger">{formError}</p>}
      </form>

      {actionError && <p className="mt-3 text-sm text-danger">{actionError}</p>}

      <div className="mt-6 flex flex-col gap-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">Could not load your tasks: {loadError}</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted">
            {tasks.length === 0
              ? "No tasks yet. Add your first task above to get started."
              : "Nothing to show. Try enabling \"Show completed\"."}
          </p>
        ) : (
          grouped.map(([groupName, groupTasks]) => (
            <div key={groupName} className="flex flex-col gap-1.5">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {groupName}
                <span className="ml-1.5 font-normal normal-case">({groupTasks.length})</span>
              </h2>
              <ul className="flex flex-col gap-1">
                {groupTasks.map((task) => (
                  <li
                    key={task.id}
                    className="card animate-fade-in flex items-start gap-3 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCompleted(task)}
                      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        task.completed
                          ? "border-accent bg-accent"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      {task.completed && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-background stroke-[2]">
                          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                      title={`${PRIORITY_LABEL[task.priority]} priority`}
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          task.completed ? "text-muted line-through" : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.notes && (
                        <p className={`mt-0.5 truncate text-xs text-muted ${task.completed ? "line-through" : ""}`}>
                          {task.notes}
                        </p>
                      )}
                      {task.due_date && (
                        <p
                          className={`mt-0.5 text-xs ${
                            !task.completed && isOverdue(task.due_date) ? "text-danger" : "text-muted"
                          }`}
                        >
                          Due {formatDueDate(task.due_date)}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(task)}
                      aria-label="Delete task"
                      className="shrink-0 rounded-md px-1.5 py-1 text-muted transition-colors hover:text-danger"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3 fill-none stroke-current stroke-[1.5]"
                        aria-hidden="true"
                      >
                        <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
