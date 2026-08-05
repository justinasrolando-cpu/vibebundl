"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "applied" | "interview" | "offer" | "rejected";

type JobApplication = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: Status;
  notes: string | null;
  applied_at: string;
  created_at: string;
};

const STATUSES: Status[] = ["applied", "interview", "offer", "rejected"];

const STATUS_LABEL: Record<Status, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

const STATUS_DOT: Record<Status, string> = {
  applied: "bg-muted",
  interview: "bg-accent",
  offer: "bg-foreground",
  rejected: "bg-danger",
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function JobsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [appliedAt, setAppliedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAppliedAt, setEditAppliedAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("applied_at", { ascending: false });
    if (error) {
      setListError(error.message);
    } else {
      setListError(null);
      setJobs((data ?? []) as JobApplication[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadJobs();
    })();
  }, [supabase, loadJobs]);

  const resetForm = () => {
    setCompany("");
    setRole("");
    setAppliedAt(todayISO());
    setNotes("");
    setShowForm(false);
    setFormError(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !company.trim() || !role.trim()) return;
    setFormError(null);
    setAdding(true);
    const { data, error } = await supabase
      .from("job_applications")
      .insert({
        user_id: userId,
        company: company.trim(),
        role: role.trim(),
        status: "applied",
        notes: notes.trim(),
        applied_at: appliedAt || todayISO(),
      })
      .select()
      .single();
    if (!error && data) {
      setJobs((prev) => [data as JobApplication, ...prev]);
      resetForm();
    } else if (error) {
      setFormError(error.message);
    }
    setAdding(false);
  };

  const handleStatusChange = async (job: JobApplication, status: Status) => {
    if (status === job.status) return;
    setListError(null);
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status } : j)));
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", job.id);
    if (error) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: job.status } : j)));
      setListError(`Could not move ${job.company}: ${error.message}`);
    }
  };

  const sortJobs = (list: JobApplication[]) =>
    [...list].sort((a, b) => (a.applied_at < b.applied_at ? 1 : a.applied_at > b.applied_at ? -1 : 0));

  const handleDelete = async (job: JobApplication) => {
    setListError(null);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    if (editingId === job.id) setEditingId(null);
    const { error } = await supabase.from("job_applications").delete().eq("id", job.id);
    if (error) {
      setJobs((prev) => sortJobs([...prev, job]));
      setListError(`Could not delete ${job.company}: ${error.message}`);
    }
  };

  const startEdit = (job: JobApplication) => {
    setEditingId(job.id);
    setEditCompany(job.company);
    setEditRole(job.role);
    setEditAppliedAt(job.applied_at);
    setEditNotes(job.notes ?? "");
    setEditError(null);
  };

  const handleSaveEdit = async (job: JobApplication) => {
    if (!editCompany.trim() || !editRole.trim()) {
      setEditError("Company and role are required.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    const patch = {
      company: editCompany.trim(),
      role: editRole.trim(),
      // notes is `not null default ''` — send an empty string, never null.
      notes: editNotes.trim(),
      applied_at: editAppliedAt || todayISO(),
    };
    const { error } = await supabase.from("job_applications").update(patch).eq("id", job.id);
    if (error) {
      setEditError(error.message);
      setSavingEdit(false);
      return;
    }
    setJobs((prev) => sortJobs(prev.map((j) => (j.id === job.id ? { ...j, ...patch } : j))));
    setEditingId(null);
    setSavingEdit(false);
  };

  const columns = useMemo(() => {
    const map: Record<Status, JobApplication[]> = {
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    };
    for (const job of jobs) {
      (map[job.status] ?? map.applied).push(job);
    }
    return map;
  }, [jobs]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Job Application Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            {jobs.length} application{jobs.length === 1 ? "" : "s"} tracked · use the dropdown on a card to
            move it between stages
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add application"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card animate-fade-in mt-4 flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Company</label>
              <input
                className="input w-full"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Role</label>
              <input
                className="input w-full"
                placeholder="Senior Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Applied on</label>
            <input
              type="date"
              className="input w-full sm:w-48"
              value={appliedAt}
              onChange={(e) => setAppliedAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Referral from...; recruiter contact; interview prep notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? "Adding..." : "Add application"}
            </button>
          </div>
        </form>
      )}

      {listError && <p className="mt-4 text-sm text-danger">{listError}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading...</p>
      ) : jobs.length === 0 ? (
        <div className="card animate-fade-in mt-6 p-6 text-center">
          <p className="text-sm text-muted">No applications yet. Add one to start tracking your job search.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUSES.map((status) => (
            <div key={status} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                <h2 className="text-sm font-medium">{STATUS_LABEL[status]}</h2>
                <span className="text-xs text-muted">({columns[status].length})</span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface/30 p-2">
                {columns[status].length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted">Empty</p>
                ) : (
                  columns[status].map((job) =>
                    editingId === job.id ? (
                      <div key={job.id} className="card animate-fade-in flex flex-col gap-2 p-3">
                        <input
                          className="input w-full text-xs"
                          placeholder="Company"
                          value={editCompany}
                          onChange={(e) => setEditCompany(e.target.value)}
                        />
                        <input
                          className="input w-full text-xs"
                          placeholder="Role"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        />
                        <input
                          type="date"
                          className="input w-full text-xs"
                          value={editAppliedAt}
                          onChange={(e) => setEditAppliedAt(e.target.value)}
                        />
                        <textarea
                          className="input w-full text-xs"
                          rows={4}
                          placeholder="Notes for this stage — recruiter contact, interview prep, next step…"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                        {editError && <p className="text-sm text-danger">{editError}</p>}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            onClick={() => {
                              setEditingId(null);
                              setEditError(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary text-xs"
                            onClick={() => handleSaveEdit(job)}
                            disabled={savingEdit}
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={job.id} className="card animate-fade-in flex flex-col gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{job.company}</p>
                            <p className="truncate text-xs text-muted">{job.role}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              className="text-xs text-muted transition-colors hover:text-foreground"
                              onClick={() => startEdit(job)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs text-muted transition-colors hover:text-danger"
                              onClick={() => handleDelete(job)}
                              aria-label={`Delete application at ${job.company}`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted">Applied {formatDate(job.applied_at)}</p>
                        {job.notes ? (
                          <p className="whitespace-pre-wrap text-xs text-foreground/80">{job.notes}</p>
                        ) : (
                          <p className="text-xs text-muted-2">No notes yet — use Edit to add some.</p>
                        )}
                        <label className="sr-only" htmlFor={`status-${job.id}`}>
                          Stage for {job.company}
                        </label>
                        <select
                          id={`status-${job.id}`}
                          className="input mt-1 w-full text-xs"
                          value={job.status}
                          onChange={(e) => handleStatusChange(job, e.target.value as Status)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
