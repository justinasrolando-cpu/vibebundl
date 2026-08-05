"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Feed = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  created_at: string;
};

type FetchedItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
};

type Item = FetchedItem & {
  feedId: string;
  feedTitle: string;
};

const supabase = createClient();

const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

function relativeTime(iso: string | null): string {
  if (!iso) return "no date";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "no date";
  const diff = then - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return RTF.format(Math.round(diff / ms), unit);
  }
  return RTF.format(Math.round(diff / 1000), "second");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function feedLabel(feed: Feed): string {
  return feed.title.trim() || hostnameOf(feed.url);
}

async function fetchFeed(url: string): Promise<{ title: string; items: FetchedItem[] }> {
  const res = await fetch("/api/rss/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return {
    title: typeof payload?.title === "string" ? payload.title : "",
    items: Array.isArray(payload?.items) ? (payload.items as FetchedItem[]) : [],
  };
}

export default function RssPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const [feedsError, setFeedsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("all");

  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemErrors, setItemErrors] = useState<string[]>([]);

  const [readUrls, setReadUrls] = useState<Set<string>>(new Set());
  const [readError, setReadError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const requestRef = useRef(0);

  const loadFeeds = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("rss_feeds")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error) {
      setFeedsError(error.message);
      return [] as Feed[];
    }
    setFeedsError(null);
    const rows = (data ?? []) as Feed[];
    setFeeds(rows);
    return rows;
  }, []);

  const loadReadState = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("rss_read_items")
      .select("item_url")
      .eq("user_id", uid);
    if (error) {
      setReadError(error.message);
      return;
    }
    setReadUrls(new Set(((data ?? []) as { item_url: string }[]).map((r) => r.item_url)));
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        await Promise.all([loadFeeds(user.id), loadReadState(user.id)]);
      } else {
        setFeedsError("You are signed out. Sign in again to see your subscriptions.");
      }
      setLoadingFeeds(false);
    })();
  }, [loadFeeds, loadReadState]);

  const targetFeeds = useMemo(
    () => (selectedId === "all" ? feeds : feeds.filter((f) => f.id === selectedId)),
    [feeds, selectedId],
  );

  const loadItems = useCallback(async (targets: Feed[]) => {
    const requestId = ++requestRef.current;
    if (targets.length === 0) {
      setItems([]);
      setItemErrors([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);
    setItemErrors([]);

    const results = await Promise.allSettled(targets.map((f) => fetchFeed(f.url)));
    if (requestId !== requestRef.current) return;

    const collected: Item[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
      const feed = targets[i];
      if (result.status === "fulfilled") {
        for (const item of result.value.items) {
          collected.push({
            ...item,
            feedId: feed.id,
            feedTitle: result.value.title.trim() || feedLabel(feed),
          });
        }
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "Unknown error";
        errors.push(`${feedLabel(feed)}: ${message}`);
      }
    });

    collected.sort((a, b) => {
      const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bt - at;
    });

    setItems(collected);
    setItemErrors(errors);
    setLoadingItems(false);
  }, []);

  useEffect(() => {
    if (loadingFeeds) return;
    (async () => {
      await loadItems(targetFeeds);
    })();
  }, [loadingFeeds, targetFeeds, loadItems]);

  const unreadCount = useMemo(
    () => items.filter((i) => i.link && !readUrls.has(i.link)).length,
    [items, readUrls],
  );

  async function handleAddFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setAddError("You are signed out. Sign in again to subscribe.");
      return;
    }
    const url = normalizeUrl(newUrl);
    if (!url) return;

    if (feeds.some((f) => f.url === url)) {
      setAddError("You are already subscribed to that feed.");
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      // Resolve the feed once on add so we can store a human-readable title.
      const { title } = await fetchFeed(url);
      const { data, error } = await supabase
        .from("rss_feeds")
        .insert({ user_id: userId, url, title: title.trim() })
        .select()
        .single();

      if (error) {
        setAddError(error.message);
      } else if (data) {
        setFeeds((prev) => [...prev, data as Feed]);
        setNewUrl("");
        setSelectedId((data as Feed).id);
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not read that feed.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteFeed(feed: Feed) {
    if (!userId) return;
    if (!confirm(`Unsubscribe from "${feedLabel(feed)}"?`)) return;

    const { error } = await supabase
      .from("rss_feeds")
      .delete()
      .eq("id", feed.id)
      .eq("user_id", userId);

    if (error) {
      setFeedsError(error.message);
      return;
    }
    setFeedsError(null);
    setFeeds((prev) => prev.filter((f) => f.id !== feed.id));
    setItems((prev) => prev.filter((i) => i.feedId !== feed.id));
    if (selectedId === feed.id) setSelectedId("all");
  }

  const markRead = useCallback(
    async (link: string) => {
      if (!userId || !link) return;
      setReadUrls((prev) => {
        if (prev.has(link)) return prev;
        const next = new Set(prev);
        next.add(link);
        return next;
      });

      // Duplicate (user_id, item_url) rows are expected — ignore the conflict.
      const { error } = await supabase
        .from("rss_read_items")
        .upsert(
          { user_id: userId, item_url: link },
          { onConflict: "user_id,item_url", ignoreDuplicates: true },
        );

      if (error && error.code !== "23505") {
        setReadError(error.message);
      } else {
        setReadError(null);
      }
    },
    [userId],
  );

  async function handleMarkAllRead() {
    if (!userId) return;
    const unread = items.filter((i) => i.link && !readUrls.has(i.link));
    if (unread.length === 0) return;

    setMarkingAll(true);
    const links = Array.from(new Set(unread.map((i) => i.link)));

    setReadUrls((prev) => {
      const next = new Set(prev);
      links.forEach((l) => next.add(l));
      return next;
    });

    const { error } = await supabase.from("rss_read_items").upsert(
      links.map((item_url) => ({ user_id: userId, item_url })),
      { onConflict: "user_id,item_url", ignoreDuplicates: true },
    );

    if (error && error.code !== "23505") {
      setReadError(error.message);
    } else {
      setReadError(null);
    }
    setMarkingAll(false);
  }

  const selectedFeed = feeds.find((f) => f.id === selectedId) ?? null;
  const headerTitle = selectedId === "all" ? "All feeds" : selectedFeed ? feedLabel(selectedFeed) : "All feeds";

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sidebar: subscriptions */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-72 md:shrink-0 md:border-b-0 md:border-r">
        <div className="p-4 pb-3">
          <h1 className="text-lg font-semibold">RSS Reader</h1>
          <p className="mt-1 text-xs text-muted">Subscribe to feeds and read everything in one list.</p>
        </div>

        <form onSubmit={handleAddFeed} className="flex gap-2 px-4 pb-2">
          <input
            className="input w-full text-sm"
            placeholder="https://example.com/feed.xml"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary shrink-0 text-xs" disabled={adding || !newUrl.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {addError && <p className="px-4 pb-2 text-sm text-danger">{addError}</p>}
        {feedsError && <p className="px-4 pb-2 text-sm text-danger">{feedsError}</p>}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <button
            onClick={() => setSelectedId("all")}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedId === "all" ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover"
            }`}
          >
            All feeds
            <span className="ml-1.5 text-xs text-muted">{feeds.length}</span>
          </button>

          {loadingFeeds ? (
            <p className="px-3 py-4 text-sm text-muted">Loading feeds…</p>
          ) : feeds.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">
              No subscriptions yet. Paste a feed URL above — most blogs expose one at /feed or /rss.xml.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {feeds.map((feed) => (
                <li key={feed.id} className="animate-fade-in group flex items-center gap-1">
                  <button
                    onClick={() => setSelectedId(feed.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition-colors ${
                      selectedId === feed.id ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover"
                    }`}
                    title={feed.url}
                  >
                    <span className="block truncate text-sm">{feedLabel(feed)}</span>
                    <span className="block truncate text-xs text-muted">{hostnameOf(feed.url)}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFeed(feed)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-muted transition-colors hover:text-danger"
                    aria-label={`Unsubscribe from ${feedLabel(feed)}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main pane: items */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{headerTitle}</h2>
            <p className="text-xs text-muted">
              {loadingFeeds || loadingItems
                ? "Fetching…"
                : `${items.length} item${items.length === 1 ? "" : "s"} · ${unreadCount} unread`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              className="btn btn-secondary text-xs"
              onClick={() => loadItems(targetFeeds)}
              disabled={loadingItems || targetFeeds.length === 0}
            >
              {loadingItems ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="btn btn-secondary text-xs"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
          </div>
        </div>

        {itemErrors.length > 0 && (
          <div className="border-b border-border px-4 py-2">
            {itemErrors.map((message) => (
              <p key={message} className="text-sm text-danger">
                {message}
              </p>
            ))}
          </div>
        )}
        {readError && <p className="px-4 pt-2 text-sm text-danger">{readError}</p>}

        <div className="p-4">
          {loadingFeeds || loadingItems ? (
            <p className="text-sm text-muted">Loading items…</p>
          ) : feeds.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing to read yet. Add your first feed on the left to start pulling in articles.
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">
              No items in this selection. The feed may be empty, or refresh to try again.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item, i) => {
                const isRead = !!item.link && readUrls.has(item.link);
                return (
                  <li
                    key={`${item.feedId}-${item.link || item.title}-${i}`}
                    style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                    className="card animate-fade-in cursor-pointer p-3 transition-colors hover:bg-surface-hover"
                    onClick={() => markRead(item.link)}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markRead(item.link)}
                          className={`text-sm font-medium hover:text-accent ${
                            isRead ? "text-muted" : "text-foreground"
                          }`}
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className={`text-sm font-medium ${isRead ? "text-muted" : "text-foreground"}`}>
                          {item.title}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-muted">{relativeTime(item.publishedAt)}</span>
                    </div>

                    {item.summary && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">{item.summary}</p>
                    )}

                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      {selectedId === "all" && <span className="truncate">{item.feedTitle}</span>}
                      {!isRead && <span className="text-accent">● unread</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
