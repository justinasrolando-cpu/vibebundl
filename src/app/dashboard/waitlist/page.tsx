"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Waitlist = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
};

type WaitlistWithCount = Waitlist & { signupCount: number };

type Signup = { id: string; email: string; created_at: string };

/** RFC 4180: wrap in quotes, double any embedded quote. */
function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function WaitlistPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [waitlists, setWaitlists] = useState<WaitlistWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openSignupsId, setOpenSignupsId] = useState<string | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);

  async function loadWaitlists(ownerId?: string | null) {
    setLoading(true);
    setError(null);

    const uid = ownerId ?? userId;
    if (!uid) {
      setWaitlists([]);
      setLoading(false);
      return;
    }

    const { data: waitlistsData, error: waitlistsError } = await supabase
      .from("waitlists")
      .select("id, slug, title, description, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (waitlistsError) {
      setError(waitlistsError.message);
      setLoading(false);
      return;
    }

    const list = (waitlistsData ?? []) as Waitlist[];

    if (list.length === 0) {
      setWaitlists([]);
      setLoading(false);
      return;
    }

    const { data: signupsData, error: signupsError } = await supabase
      .from("waitlist_signups")
      .select("waitlist_id")
      .in(
        "waitlist_id",
        list.map((w) => w.id),
      );

    if (signupsError) {
      setError(signupsError.message);
      setLoading(false);
      return;
    }

    const counts = new Map<string, number>();
    for (const row of signupsData ?? []) {
      const id = (row as { waitlist_id: string }).waitlist_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    setWaitlists(
      list.map((w) => ({ ...w, signupCount: counts.get(w.id) ?? 0 })),
    );
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadWaitlists(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setSlug("");
    setSlugTouched(false);
    setTitle("");
    setDescription("");
  }

  function startEdit(w: Waitlist) {
    setEditingId(w.id);
    setSlug(w.slug);
    setSlugTouched(true);
    setTitle(w.title);
    setDescription(w.description ?? "");
    setError(null);
    // The form sits above the list; without this, clicking Edit on a row
    // further down looks like nothing happened.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched && !editingId) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error: updateError } = await supabase
        .from("waitlists")
        .update({ slug: cleanSlug, title: title.trim(), description: description.trim() })
        .eq("id", editingId);

      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "That slug is already taken."
            : updateError.message,
        );
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("waitlists").insert({
        user_id: userId,
        slug: cleanSlug,
        title: title.trim(),
        description: description.trim(),
      });

      if (insertError) {
        setError(
          insertError.code === "23505"
            ? "That slug is already taken."
            : insertError.message,
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    resetForm();
    await loadWaitlists();
  }

  async function handleDelete(w: WaitlistWithCount) {
    const confirmed = window.confirm(
      `Delete "${w.title}"? Its public page stops working and all ${w.signupCount} signup${
        w.signupCount === 1 ? "" : "s"
      } are removed. This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(w.id);
    const { error: deleteError } = await supabase
      .from("waitlists")
      .delete()
      .eq("id", w.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === w.id) resetForm();
    if (openSignupsId === w.id) {
      setOpenSignupsId(null);
      setSignups([]);
    }
    setWaitlists((prev) => prev.filter((x) => x.id !== w.id));
  }

  async function toggleSignups(w: WaitlistWithCount) {
    if (openSignupsId === w.id) {
      setOpenSignupsId(null);
      setSignups([]);
      return;
    }

    setOpenSignupsId(w.id);
    setSignups([]);
    setSignupsLoading(true);
    setError(null);

    const { data, error: signupsError } = await supabase
      .from("waitlist_signups")
      .select("id, email, created_at")
      .eq("waitlist_id", w.id)
      .order("created_at", { ascending: false })
      .limit(200);

    setSignupsLoading(false);
    if (signupsError) {
      setError(signupsError.message);
      return;
    }
    setSignups((data ?? []) as Signup[]);
  }

  async function handleDownloadCsv(w: WaitlistWithCount) {
    setDownloadingId(w.id);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("waitlist_signups")
      .select("email, created_at")
      .eq("waitlist_id", w.id)
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setDownloadingId(null);
      return;
    }

    const rows = (data ?? []) as { email: string; created_at: string }[];
    if (rows.length === 0) {
      setError("No signups to export yet.");
      setDownloadingId(null);
      return;
    }

    const csvLines = [
      "email,joined_at",
      ...rows.map((r) => `${csvCell(r.email)},${csvCell(r.created_at)}`),
    ];
    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.slug}-signups.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloadingId(null);
  }

  const publicOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Waitlist Pages</h1>
      <p className="mt-1 text-sm text-muted">
        Create a public waitlist landing page, collect emails, export as CSV. No
        emails are sent from here — signups are stored for you to export.
      </p>

      <form
        onSubmit={handleSubmit}
        className="card animate-fade-in mt-6 flex flex-col gap-3 p-4"
      >
        <p className="text-sm font-medium">
          {editingId ? "Edit waitlist" : "New waitlist"}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="My Product Launch"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="my-product-launch"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Be the first to know when we launch."
          />
        </div>

        {slug && (
          <p className="text-xs text-muted">
            Public URL:{" "}
            <span className="text-foreground">
              {publicOrigin}/w/{slugify(slug)}
            </span>
          </p>
        )}

        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create waitlist"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : waitlists.length === 0 ? (
          <div className="card p-4 text-sm text-muted">
            No waitlists yet. Create one above to get a public signup page.
          </div>
        ) : (
          waitlists.map((w, i) => (
            <div
              key={w.id}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="card animate-fade-in flex flex-col gap-2 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{w.title}</p>
                  <p className="truncate text-xs text-muted">
                    {publicOrigin}/w/{w.slug} · {w.signupCount}{" "}
                    {w.signupCount === 1 ? "signup" : "signups"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a
                    href={`/w/${w.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => toggleSignups(w)}
                  >
                    {openSignupsId === w.id ? "Hide signups" : "Signups"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => startEdit(w)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDownloadCsv(w)}
                    disabled={downloadingId === w.id}
                  >
                    {downloadingId === w.id ? "Preparing…" : "Download CSV"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-danger"
                    onClick={() => handleDelete(w)}
                    disabled={deletingId === w.id}
                  >
                    {deletingId === w.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {openSignupsId === w.id && (
                <div className="animate-fade-in mt-1 border-t border-border pt-3">
                  {signupsLoading ? (
                    <p className="text-xs text-muted">Loading signups…</p>
                  ) : signups.length === 0 ? (
                    <p className="text-xs text-muted">
                      Nobody has signed up yet. Share {publicOrigin}/w/{w.slug} to
                      start collecting emails.
                    </p>
                  ) : (
                    <>
                      <ul className="scroll-slim flex max-h-64 flex-col gap-1 overflow-y-auto">
                        {signups.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="truncate">{s.email}</span>
                            <span className="shrink-0 tnum text-muted">
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {signups.length === 200 && (
                        <p className="mt-2 text-xs text-muted">
                          Showing the 200 most recent. Download the CSV for the
                          full list.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
