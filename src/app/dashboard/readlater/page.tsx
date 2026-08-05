"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "unread" | "read" | "archived";

type ReadLaterItem = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  status: Status;
  created_at: string;
};

const TABS: { key: Status; label: string }[] = [
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "archived", label: "Archived" },
];

function displayTitle(item: ReadLaterItem) {
  return item.title?.trim() || item.url;
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ReadLaterPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ReadLaterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("unread");

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (uid: string) => {
      const { data, error: fetchError } = await supabase
        .from("readlater_items")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setItems((data ?? []) as ReadLaterItem[]);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      if (!data.user) {
        setError("You are signed out. Sign in again to see your reading list.");
        setLoading(false);
        return;
      }
      await loadItems(data.user.id);
    })();
  }, [supabase, loadItems]);

  const filtered = useMemo(() => items.filter((item) => item.status === tab), [items, tab]);
  const counts = useMemo(() => {
    const c: Record<Status, number> = { unread: 0, read: 0, archived: 0 };
    for (const item of items) c[item.status]++;
    return c;
  }, [items]);

  function normalizeUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    if (!userId) {
      setError("You are signed out. Sign in again to save articles.");
      return;
    }
    setError(null);

    const normalized = normalizeUrl(url);
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("Only http:// and https:// links can be saved.");
      return;
    }

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("readlater_items")
      .insert({
        user_id: userId,
        url: normalized,
        title: title.trim(),
        status: "unread",
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save that link. Try again.");
      setSaving(false);
      return;
    }

    setItems((prev) => [data as ReadLaterItem, ...prev]);
    setUrl("");
    setTitle("");
    setSaving(false);
    setTab("unread");
  }

  async function updateStatus(id: string, status: Status) {
    const previous = items;
    setError(null);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    const { error: updateError } = await supabase.from("readlater_items").update({ status }).eq("id", id);
    if (updateError) {
      setError(`Could not update that item: ${updateError.message}`);
      setItems(previous);
    }
  }

  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (!confirm(`Delete "${displayTitle(item)}"? This cannot be undone.`)) return;
    const previous = items;
    setError(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error: deleteError } = await supabase.from("readlater_items").delete().eq("id", id);
    if (deleteError) {
      setError(`Could not delete that item: ${deleteError.message}`);
      setItems(previous);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Read Later</h1>
      <p className="mt-1 text-sm text-muted">
        Save articles to read later, then track what you&apos;ve read. Links are stored as-is — the article
        text is not extracted, so opening one takes you to the original page.
      </p>

      <form onSubmit={handleSubmit} className="card animate-fade-in mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="url" className="mb-1 block text-xs text-muted">
            URL
          </label>
          <input
            id="url"
            className="input w-full"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>

        <div className="flex-1">
          <label htmlFor="title" className="mb-1 block text-xs text-muted">
            Title (optional)
          </label>
          <input
            id="title"
            className="input w-full"
            placeholder="Article title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving || !url.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-1.5 transition-colors ${
              tab === t.key ? "bg-surface-hover text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {tab === "unread"
            ? items.length === 0
              ? "Nothing saved yet. Paste a link above and it lands here."
              : "Nothing left to read. Everything you saved is marked read or archived."
            : tab === "read"
              ? "No items marked as read yet. Hit “Mark read” on an unread item to move it here."
              : "No archived items. Archive anything you want out of the way but not deleted."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {filtered.map((item, i) => (
            <div
              key={item.id}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="card animate-fade-in flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-foreground hover:text-accent"
                  title={item.url}
                >
                  {displayTitle(item)}
                </a>
                <p className="mt-0.5 truncate text-xs text-muted">{hostnameOf(item.url)}</p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {item.status !== "unread" && (
                  <button onClick={() => updateStatus(item.id, "unread")} className="btn btn-secondary text-xs">
                    Back to unread
                  </button>
                )}
                {item.status !== "read" && (
                  <button onClick={() => updateStatus(item.id, "read")} className="btn btn-secondary text-xs">
                    Mark read
                  </button>
                )}
                {item.status !== "archived" && (
                  <button onClick={() => updateStatus(item.id, "archived")} className="btn btn-secondary text-xs">
                    Archive
                  </button>
                )}
                <button onClick={() => handleDelete(item.id)} className="btn btn-secondary text-xs text-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
