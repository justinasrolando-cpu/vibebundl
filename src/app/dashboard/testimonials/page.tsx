"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Space = {
  id: string;
  slug: string;
  title: string;
  created_at: string;
};

type Testimonial = {
  id: string;
  space_id: string;
  author_name: string;
  author_email: string | null;
  content: string;
  approved: boolean;
  created_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function TestimonialsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // space form state
  const [editingSpace, setEditingSpace] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAll(ownerId?: string | null) {
    setLoading(true);
    setError(null);

    const uid = ownerId ?? userId;
    if (!uid) {
      setSpace(null);
      setTestimonials([]);
      setError("You are signed out. Sign in again to manage your testimonials.");
      setLoading(false);
      return;
    }

    // NOTE: testimonial_spaces has BOTH a public select policy and an owner
    // policy, so the user_id filter is required — RLS alone returns every
    // user's rows. limit(1) rather than a bare maybeSingle(): maybeSingle
    // throws if a user ends up with two spaces, bricking the whole page.
    const { data: spaceRows, error: spaceError } = await supabase
      .from("testimonial_spaces")
      .select("id, slug, title, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1);

    if (spaceError) {
      setError(spaceError.message);
      setLoading(false);
      return;
    }

    const currentSpace = (spaceRows?.[0] ?? null) as Space | null;
    setSpace(currentSpace);

    if (!currentSpace) {
      setTestimonials([]);
      setLoading(false);
      return;
    }

    const { data: testimonialsData, error: testimonialsError } =
      await supabase
        .from("testimonials")
        .select(
          "id, space_id, author_name, author_email, content, approved, created_at",
        )
        .eq("space_id", currentSpace.id)
        .order("created_at", { ascending: false });

    if (testimonialsError) {
      setError(testimonialsError.message);
      setLoading(false);
      return;
    }

    setTestimonials((testimonialsData ?? []) as Testimonial[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadAll(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditSpace() {
    if (space) {
      setSlug(space.slug);
      setSlugTouched(true);
      setTitle(space.title);
    }
    setEditingSpace(true);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched && !space) {
      setSlug(slugify(value));
    }
  }

  async function handleSpaceSubmit(e: FormEvent) {
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

    if (space) {
      const { error: updateError } = await supabase
        .from("testimonial_spaces")
        .update({ slug: cleanSlug, title: title.trim() })
        .eq("id", space.id);

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
      const { error: insertError } = await supabase
        .from("testimonial_spaces")
        .insert({ user_id: userId, slug: cleanSlug, title: title.trim() });

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
    setEditingSpace(false);
    await loadAll();
  }

  async function handleApprove(t: Testimonial) {
    setBusyId(t.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("testimonials")
      .update({ approved: true })
      .eq("id", t.id);

    if (updateError) {
      setError(updateError.message);
      setBusyId(null);
      return;
    }

    await loadAll();
    setBusyId(null);
  }

  async function handleUnapprove(t: Testimonial) {
    setBusyId(t.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("testimonials")
      .update({ approved: false })
      .eq("id", t.id);

    if (updateError) {
      setError(updateError.message);
      setBusyId(null);
      return;
    }

    await loadAll();
    setBusyId(null);
  }

  async function handleDelete(t: Testimonial) {
    if (
      !confirm(
        `Delete the testimonial from ${t.author_name || "Anonymous"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusyId(t.id);
    setError(null);

    const { error: deleteError } = await supabase
      .from("testimonials")
      .delete()
      .eq("id", t.id);

    if (deleteError) {
      setError(deleteError.message);
      setBusyId(null);
      return;
    }

    await loadAll();
    setBusyId(null);
  }

  const publicOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  const pending = testimonials.filter((t) => !t.approved);
  const approved = testimonials.filter((t) => t.approved);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Testimonials</h1>
      <p className="mt-1 text-sm text-muted">
        Collect testimonials with a public form, approve the good ones, and
        show them off on a public wall of love.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : !space || editingSpace ? (
        <form
          onSubmit={handleSpaceSubmit}
          className="card animate-fade-in mt-6 flex flex-col gap-3 p-4"
        >
          <p className="text-sm font-medium">
            {space ? "Edit collection space" : "Create your collection space"}
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
                placeholder="What our customers say"
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
                placeholder="my-product"
                required
              />
            </div>
          </div>

          {slug && (
            <p className="text-xs text-muted">
              Public URL:{" "}
              <span className="text-foreground">
                {publicOrigin}/t/{slugify(slug)}
              </span>
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : space ? "Save changes" : "Create space"}
            </button>
            {space && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingSpace(false)}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="card animate-fade-in mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{space.title}</p>
            <p className="truncate text-xs text-muted">
              Public collection URL: {publicOrigin}/t/{space.slug}
            </p>
            <p className="mt-1 text-xs text-muted">
              Approved testimonials appear automatically on that public wall of
              love page. New submissions are loaded when this page loads — hit
              Refresh to check for more.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/t/${space.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              View wall
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadAll()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={startEditSpace}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {error && space && !editingSpace && (
        <p className="mt-3 text-sm text-danger">{error}</p>
      )}

      {space && !editingSpace && (
        <div className="mt-8 flex flex-col gap-8">
          <section>
            <h2 className="text-sm font-semibold">
              Pending review{" "}
              <span className="text-xs font-normal text-muted">
                ({pending.length})
              </span>
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {pending.length === 0 ? (
                <div className="card p-4 text-sm text-muted">
                  Nothing waiting on review. New submissions from your public
                  page will show up here.
                </div>
              ) : (
                pending.map((t, i) => (
                  <div
                    key={t.id}
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    className="card animate-fade-in flex flex-col gap-2 border-l-2 border-l-accent p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {t.author_name || "Anonymous"}
                        </p>
                        {t.author_email && (
                          <p className="truncate text-xs text-muted">
                            {t.author_email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {t.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleApprove(t)}
                        disabled={busyId === t.id}
                      >
                        {busyId === t.id ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDelete(t)}
                        disabled={busyId === t.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">
              Approved{" "}
              <span className="text-xs font-normal text-muted">
                ({approved.length})
              </span>
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {approved.length === 0 ? (
                <div className="card p-4 text-sm text-muted">
                  No approved testimonials yet. Approve one above to have it
                  show up on your public wall.
                </div>
              ) : (
                approved.map((t, i) => (
                  <div
                    key={t.id}
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    className="card animate-fade-in flex flex-col gap-2 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {t.author_name || "Anonymous"}
                        </p>
                        {t.author_email && (
                          <p className="truncate text-xs text-muted">
                            {t.author_email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {t.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleUnapprove(t)}
                        disabled={busyId === t.id}
                      >
                        {busyId === t.id ? "Working…" : "Unapprove"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDelete(t)}
                        disabled={busyId === t.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
