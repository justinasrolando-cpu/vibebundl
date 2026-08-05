"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Bookmark = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const parseTags = (raw: string): string[] =>
  raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export default function BookmarksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Add-form state
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBookmarks = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setBookmarks((data ?? []) as Bookmark[]);
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
        setLoadError("You are signed out. Sign in again to see your bookmarks.");
        setLoading(false);
        return;
      }
      await loadBookmarks(user.id);
    })();
  }, [supabase, loadBookmarks]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => (b.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookmarks.filter((b) => {
      const matchesQuery =
        !q ||
        (b.title ?? "").toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q) ||
        (b.url ?? "").toLowerCase().includes(q);
      const matchesTag = !activeTag || (b.tags ?? []).includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [bookmarks, search, activeTag]);

  /** Best-effort page-title lookup. Never blocks the save. */
  const fetchTitle = async (url: string): Promise<string> => {
    try {
      const res = await fetch("/api/bookmarks/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return "";
      const json: unknown = await res.json();
      const title = (json as { title?: unknown })?.title;
      return typeof title === "string" ? title : "";
    } catch {
      return "";
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!userId) {
      setFormError("You are signed out. Sign in again to save bookmarks.");
      return;
    }
    const url = normalizeUrl(formUrl);
    if (!url) {
      setFormError("URL is required.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setFormError("That doesn't look like a valid URL.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setFormError("Only http:// and https:// links can be saved.");
      return;
    }

    setSubmitting(true);

    // Empty title -> try to read the page's own title before saving.
    let title = formTitle.trim();
    if (!title) title = await fetchTitle(url);

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: userId,
        url,
        title,
        description: formDescription.trim(),
        tags: parseTags(formTags),
      })
      .select()
      .single();

    if (error || !data) {
      setFormError(error?.message ?? "Could not save that bookmark. Try again.");
      setSubmitting(false);
      return;
    }

    setBookmarks((prev) => [data as Bookmark, ...prev]);
    setFormUrl("");
    setFormTitle("");
    setFormDescription("");
    setFormTags("");
    setSubmitting(false);
  };

  const handleDelete = async (bookmark: Bookmark) => {
    if (!confirm(`Delete "${bookmark.title || bookmark.url}"?`)) return;
    setActionError(null);
    const { error } = await supabase.from("bookmarks").delete().eq("id", bookmark.id);
    if (error) {
      setActionError(`Could not delete that bookmark: ${error.message}`);
      return;
    }
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
  };

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Bookmarks</h1>
      <p className="mt-1 text-sm text-muted">Save and tag links you want to keep.</p>

      <form onSubmit={handleAdd} className="card mt-6 flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="input w-full sm:col-span-2"
            placeholder="https://example.com (required)"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
          />
          <input
            className="input w-full"
            placeholder="Title (optional — fetched from the page if blank)"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          <input
            className="input w-full"
            placeholder="Tags, comma separated (optional)"
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
          />
          <textarea
            className="input w-full sm:col-span-2"
            placeholder="Description (optional)"
            rows={2}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary text-xs" disabled={submitting || !userId}>
            {submitting ? "Saving…" : "+ Save bookmark"}
          </button>
          <span className="text-xs text-muted">
            Titles are read from the page&apos;s own &lt;title&gt; tag. Sites that block bots save untitled.
          </span>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input w-full sm:max-w-xs"
          placeholder="Search title, description, or URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              activeTag === null
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            all
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                activeTag === tag
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {actionError && <p className="mt-3 text-sm text-danger">{actionError}</p>}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">Could not load your bookmarks: {loadError}</p>
        ) : filteredBookmarks.length === 0 ? (
          <p className="text-sm text-muted">
            {bookmarks.length === 0
              ? "No bookmarks yet. Save your first link above."
              : "No bookmarks match your search or tag filter."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBookmarks.map((bookmark, i) => (
              <div
                key={bookmark.id}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                className="card animate-fade-in flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                  >
                    {bookmark.title || hostnameOf(bookmark.url)}
                  </a>
                  <button
                    onClick={() => handleDelete(bookmark)}
                    className="shrink-0 text-xs text-muted hover:text-danger"
                    aria-label="Delete bookmark"
                  >
                    delete
                  </button>
                </div>
                <p className="truncate text-xs text-muted">{hostnameOf(bookmark.url)}</p>
                {bookmark.description && (
                  <p className="text-xs text-muted">{bookmark.description}</p>
                )}
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {bookmark.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                        className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                          activeTag === tag
                            ? "border-accent text-accent"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-auto pt-1 text-[11px] text-muted">
                  saved {formatDate(bookmark.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
