"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Changelog = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  created_at: string;
};

type Entry = {
  id: string;
  changelog_id: string;
  version: string;
  title: string;
  body: string;
  released_on: string;
  created_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayIso() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sortEntries(list: Entry[]) {
  return [...list].sort((a, b) => {
    if (a.released_on !== b.released_on) return a.released_on < b.released_on ? 1 : -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function ChangelogPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<Changelog | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Changelog settings form
  const [editingSettings, setEditingSettings] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("Changelog");
  const [savingSettings, setSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  // New entry form
  const [newVersion, setNewVersion] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDate, setNewDate] = useState(todayIso());
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState(todayIso());
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in.");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: logData, error: logError } = await supabase
        .from("changelogs")
        .select("id, user_id, slug, title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (logError) {
        setError(logError.message);
        setLoading(false);
        return;
      }

      if (!logData) {
        setChangelog(null);
        setLoading(false);
        return;
      }

      const log = logData as Changelog;
      setChangelog(log);
      setSlug(log.slug);
      setTitle(log.title);

      const { data: entryData, error: entriesError } = await supabase
        .from("changelog_entries")
        .select("id, changelog_id, version, title, body, released_on, created_at")
        .eq("changelog_id", log.id)
        .order("released_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (entriesError) {
        setError(entriesError.message);
        setLoading(false);
        return;
      }

      setEntries(sortEntries((entryData ?? []) as Entry[]));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = changelog ? `${publicOrigin}/changelog/${changelog.slug}` : "";

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard. Copy the URL manually.");
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }
    const cleanTitle = title.trim() || "Changelog";

    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    setSavingSettings(true);

    if (changelog) {
      const { data, error: updateError } = await supabase
        .from("changelogs")
        .update({ slug: cleanSlug, title: cleanTitle })
        .eq("id", changelog.id)
        .select("id, user_id, slug, title, created_at")
        .single();

      setSavingSettings(false);

      if (updateError) {
        setError(
          updateError.code === "23505" ? "That slug is already taken." : updateError.message,
        );
        return;
      }
      setChangelog(data as Changelog);
      setEditingSettings(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("changelogs")
      .insert({ user_id: userId, slug: cleanSlug, title: cleanTitle })
      .select("id, user_id, slug, title, created_at")
      .single();

    setSavingSettings(false);

    if (insertError) {
      setError(
        insertError.code === "23505" ? "That slug is already taken." : insertError.message,
      );
      return;
    }

    setChangelog(data as Changelog);
    setEntries([]);
    setEditingSettings(false);
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    setEntryError(null);

    if (!changelog) return;
    if (!newTitle.trim()) {
      setEntryError("Entry title is required.");
      return;
    }

    setAddingEntry(true);

    const { data, error: insertError } = await supabase
      .from("changelog_entries")
      .insert({
        changelog_id: changelog.id,
        version: newVersion.trim(),
        title: newTitle.trim(),
        body: newBody.trim(),
        released_on: newDate || todayIso(),
      })
      .select("id, changelog_id, version, title, body, released_on, created_at")
      .single();

    setAddingEntry(false);

    if (insertError) {
      setEntryError(insertError.message);
      return;
    }

    setEntries((prev) => sortEntries([...prev, data as Entry]));
    setNewVersion("");
    setNewTitle("");
    setNewBody("");
    setNewDate(todayIso());
  }

  function startEditEntry(entry: Entry) {
    setEntryError(null);
    setEditingId(entry.id);
    setEditVersion(entry.version ?? "");
    setEditTitle(entry.title ?? "");
    setEditBody(entry.body ?? "");
    setEditDate(entry.released_on ?? todayIso());
  }

  async function handleSaveEntry(entryId: string) {
    setEntryError(null);

    if (!editTitle.trim()) {
      setEntryError("Entry title is required.");
      return;
    }

    setSavingEntry(true);

    const { data, error: updateError } = await supabase
      .from("changelog_entries")
      .update({
        version: editVersion.trim(),
        title: editTitle.trim(),
        body: editBody.trim(),
        released_on: editDate || todayIso(),
      })
      .eq("id", entryId)
      .select("id, changelog_id, version, title, body, released_on, created_at")
      .single();

    setSavingEntry(false);

    if (updateError) {
      setEntryError(updateError.message);
      return;
    }

    setEntries((prev) =>
      sortEntries(prev.map((en) => (en.id === entryId ? (data as Entry) : en))),
    );
    setEditingId(null);
  }

  async function handleDeleteEntry(entry: Entry) {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;

    setListError(null);
    setDeletingId(entry.id);

    const { error: deleteError } = await supabase
      .from("changelog_entries")
      .delete()
      .eq("id", entry.id);

    setDeletingId(null);

    if (deleteError) {
      setListError(deleteError.message);
      return;
    }

    setEntries((prev) => prev.filter((en) => en.id !== entry.id));
    if (editingId === entry.id) setEditingId(null);
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Changelog</h1>
      <p className="mt-1 text-sm text-muted">
        Publish release notes to a public page your users can actually follow.
      </p>
      <p className="mt-0.5 text-xs text-muted-2">
        A hosted page you link to — there is no in-app widget, email blast, or
        &ldquo;what&rsquo;s new&rdquo; popup.
      </p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {/* Changelog settings */}
      {!changelog || editingSettings ? (
        <form onSubmit={handleSaveSettings} className="card animate-fade-in mt-6 flex flex-col gap-3 p-4">
          <p className="text-sm font-medium">
            {changelog ? "Edit changelog" : "Set up your changelog"}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted" htmlFor="cl-title">
                Title
              </label>
              <input
                id="cl-title"
                className="input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched && !changelog) setSlug(slugify(e.target.value));
                }}
                placeholder="Changelog"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted" htmlFor="cl-slug">
                Slug
              </label>
              <input
                id="cl-slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="acme-app"
                required
              />
            </div>
          </div>

          {slugify(slug) && (
            <p className="text-xs text-muted">
              Public URL:{" "}
              <span className="text-foreground">
                {publicOrigin}/changelog/{slugify(slug)}
              </span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              {savingSettings ? "Saving…" : changelog ? "Save changes" : "Create changelog"}
            </button>
            {changelog && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingSettings}
                onClick={() => {
                  setEditingSettings(false);
                  setSlug(changelog.slug);
                  setTitle(changelog.title);
                  setError(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="card animate-fade-in mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{changelog.title}</p>
            <p className="truncate text-xs text-muted">{publicUrl}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy URL"}
            </button>
            <a
              href={`/changelog/${changelog.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              View
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingSettings(true)}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {changelog && (
        <>
          {/* New entry */}
          <form onSubmit={handleAddEntry} className="card animate-fade-in mt-4 flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">New entry</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted" htmlFor="e-version">
                  Version
                </label>
                <input
                  id="e-version"
                  className="input"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="v1.2.0"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-muted" htmlFor="e-title">
                  Title
                </label>
                <input
                  id="e-title"
                  className="input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Dark mode and faster search"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted" htmlFor="e-date">
                  Released on
                </label>
                <input
                  id="e-date"
                  type="date"
                  className="input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted" htmlFor="e-body">
                Body
              </label>
              <textarea
                id="e-body"
                className="input min-h-[100px] resize-y leading-relaxed"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder={"- Added dark mode\n- Search is 3x faster\n- Fixed a crash on export"}
              />
            </div>

            {entryError && !editingId && <p className="text-sm text-danger">{entryError}</p>}

            <div>
              <button type="submit" className="btn btn-primary" disabled={addingEntry}>
                {addingEntry ? "Adding…" : "Add entry"}
              </button>
            </div>
          </form>

          {/* Entries list */}
          {listError && <p className="mt-3 text-sm text-danger">{listError}</p>}

          <div className="mt-4 flex flex-col gap-3">
            {entries.length === 0 ? (
              <div className="card p-4 text-sm text-muted">
                No entries yet. Add your first release above and it appears on your public page
                right away.
              </div>
            ) : (
              entries.map((entry, i) =>
                editingId === entry.id ? (
                  <div key={entry.id} className="card animate-fade-in flex flex-col gap-3 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <input
                        className="input"
                        value={editVersion}
                        onChange={(e) => setEditVersion(e.target.value)}
                        placeholder="v1.2.0"
                      />
                      <input
                        className="input sm:col-span-2"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                      />
                      <input
                        type="date"
                        className="input"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    <textarea
                      className="input min-h-[100px] resize-y leading-relaxed"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="What changed?"
                    />

                    {entryError && <p className="text-sm text-danger">{entryError}</p>}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingEntry}
                        onClick={() => handleSaveEntry(entry.id)}
                      >
                        {savingEntry ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={savingEntry}
                        onClick={() => {
                          setEditingId(null);
                          setEntryError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={entry.id}
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    className="card animate-fade-in flex flex-col gap-2 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.version && (
                            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-accent">
                              {entry.version}
                            </span>
                          )}
                          <span className="text-xs text-muted">
                            {formatDate(entry.released_on)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{entry.title}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => startEditEntry(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-danger"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          {deletingId === entry.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    {entry.body && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {entry.body}
                      </p>
                    )}
                  </div>
                ),
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
