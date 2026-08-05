"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type DayBucket = { date: string; count: number };

type ShortLink = {
  id: string;
  slug: string;
  target_url: string;
  created_at: string;
  clicks: number;
  lastSevenDays: DayBucket[];
  referrers: { source: string; count: number }[];
};

type ClickRow = {
  link_id: string;
  clicked_at: string;
  referrer: string | null;
};

function randomSlug(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Slugs land in a URL path — strip anything that would need escaping. */
function slugifySlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function referrerSource(referrer: string | null) {
  if (!referrer) return "Direct / unknown";
  try {
    return new URL(referrer).hostname || "Direct / unknown";
  } catch {
    return referrer;
  }
}

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function ShortenerPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [targetUrl, setTargetUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openStatsId, setOpenStatsId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: linkRows, error: linkErr } = await supabase
      .from("short_links")
      .select("id, slug, target_url, created_at")
      .order("created_at", { ascending: false });

    if (linkErr) {
      setError(linkErr.message);
      setLinks([]);
      setLoading(false);
      return;
    }

    const rows = linkRows ?? [];
    if (rows.length === 0) {
      setLinks([]);
      setLoading(false);
      return;
    }

    const { data: clickRows, error: clickErr } = await supabase
      .from("short_link_clicks")
      .select("link_id, clicked_at, referrer")
      .in(
        "link_id",
        rows.map((l) => l.id),
      );

    if (clickErr) setError(clickErr.message);

    const byLink = new Map<string, ClickRow[]>();
    for (const row of (clickRows ?? []) as ClickRow[]) {
      const bucket = byLink.get(row.link_id);
      if (bucket) bucket.push(row);
      else byLink.set(row.link_id, [row]);
    }

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dayKey(d));
    }

    setLinks(
      rows.map((l) => {
        const clicks = byLink.get(l.id) ?? [];

        const perDay = new Map<string, number>();
        const perReferrer = new Map<string, number>();
        for (const c of clicks) {
          const key = c.clicked_at ? c.clicked_at.slice(0, 10) : "";
          if (key) perDay.set(key, (perDay.get(key) ?? 0) + 1);
          const src = referrerSource(c.referrer);
          perReferrer.set(src, (perReferrer.get(src) ?? 0) + 1);
        }

        return {
          ...l,
          clicks: clicks.length,
          lastSevenDays: days.map((date) => ({
            date,
            count: perDay.get(date) ?? 0,
          })),
          referrers: [...perReferrer.entries()]
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        };
      }),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadLinks();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("You need to be signed in to create a short link.");
      return;
    }
    if (!targetUrl.trim()) {
      setError("Target URL is required.");
      return;
    }

    let url = targetUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Only http and https links can be shortened.");
        return;
      }
    } catch {
      setError("That does not look like a valid URL.");
      return;
    }

    const typed = customSlug.trim();
    const slug = typed ? slugifySlug(typed) : randomSlug();
    if (typed && !slug) {
      setError("That custom slug has no usable characters. Try letters and numbers.");
      return;
    }

    setCreating(true);
    const { error: insertErr } = await supabase.from("short_links").insert({
      user_id: userId,
      slug,
      target_url: url,
    });
    setCreating(false);

    if (insertErr) {
      setError(
        insertErr.code === "23505"
          ? "That slug is already taken. Try another."
          : insertErr.message,
      );
      return;
    }

    setTargetUrl("");
    setCustomSlug("");
    await loadLinks();
  }

  async function handleDelete(id: string) {
    const previous = links;
    setError(null);
    setLinks((prev) => prev.filter((l) => l.id !== id));
    const { error: deleteErr } = await supabase
      .from("short_links")
      .delete()
      .eq("id", id);
    if (deleteErr) {
      setLinks(previous);
      setError(deleteErr.message);
    }
  }

  async function handleCopy(id: string, slug: string) {
    const url = `${siteOrigin()}/r/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setError(`Could not copy automatically. The link is ${url}`);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">URL Shortener</h1>
      <p className="mt-1 text-sm text-muted">
        Create short links and track clicks by day and referrer. Dates are UTC,
        and referrers are only as good as what the visitor&apos;s browser sends —
        anything missing counts as direct.
      </p>

      <form onSubmit={handleCreate} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted">Target URL</label>
          <input
            type="text"
            className="input w-full"
            placeholder="https://example.com/very/long/path"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <label className="mb-1 block text-xs text-muted">Custom slug (optional)</label>
          <input
            type="text"
            className="input w-full"
            placeholder="random if blank"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
          />
        </div>
        <button type="submit" disabled={creating} className="btn btn-primary shrink-0 disabled:opacity-50">
          {creating ? "Creating…" : "Create link"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : links.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">No short links yet. Create your first one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {links.map((link, i) => {
              const shortUrl = `${siteOrigin()}/r/${link.slug}`;
              const open = openStatsId === link.id;
              const peak = Math.max(
                1,
                ...link.lastSevenDays.map((d) => d.count),
              );
              return (
                <div
                  key={link.id}
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  className="card animate-fade-in flex flex-col gap-2 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/r/${link.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-medium text-accent hover:underline"
                        >
                          {shortUrl}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(link.id, link.slug)}
                          className="shrink-0 text-xs text-muted hover:text-foreground"
                        >
                          {copiedId === link.id ? "copied" : "copy"}
                        </button>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{link.target_url}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="tnum text-sm font-medium">{link.clicks}</p>
                        <p className="text-xs text-muted">{link.clicks === 1 ? "click" : "clicks"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenStatsId(open ? null : link.id)}
                        className="btn btn-secondary"
                      >
                        {open ? "Hide stats" : "Stats"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(link.id)}
                        className="btn btn-secondary text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="animate-fade-in mt-2 grid grid-cols-1 gap-4 border-t border-border pt-3 sm:grid-cols-2">
                      <div>
                        <p className="eyebrow">Last 7 days</p>
                        <div className="mt-2 flex h-16 items-end gap-1">
                          {link.lastSevenDays.map((d) => (
                            <div
                              key={d.date}
                              title={`${d.date}: ${d.count} click${d.count === 1 ? "" : "s"}`}
                              className="flex-1 rounded-sm bg-surface-3"
                              style={{
                                height: `${Math.max(4, (d.count / peak) * 100)}%`,
                                opacity: d.count === 0 ? 0.35 : 1,
                              }}
                            />
                          ))}
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-muted">
                          <span>{link.lastSevenDays[0]?.date.slice(5)}</span>
                          <span>
                            {link.lastSevenDays[link.lastSevenDays.length - 1]?.date.slice(5)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="eyebrow">Top referrers</p>
                        {link.referrers.length === 0 ? (
                          <p className="mt-2 text-xs text-muted">
                            No clicks yet — share the link and they will show up here.
                          </p>
                        ) : (
                          <ul className="mt-2 flex flex-col gap-1">
                            {link.referrers.map((r) => (
                              <li
                                key={r.source}
                                className="flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="truncate text-muted">{r.source}</span>
                                <span className="tnum shrink-0">{r.count}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
