"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Monitor = {
  id: string;
  url: string;
  label: string | null;
  last_status: string | null;
  last_checked_at: string | null;
};

type StatusPageRow = {
  id: string;
  slug: string;
  title: string;
  monitor_ids: string[];
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function StatusPageDashboard() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusPage, setStatusPage] = useState<StatusPageRow | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("Status");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Same value on the server and the client, so no hydration mismatch.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const load = useCallback(async (ownerId: string | null) => {
    if (!ownerId) {
      setStatusPage(null);
      setMonitors([]);
      setLoadError("You are signed out. Sign in again to manage your status page.");
      setLoading(false);
      return;
    }

    // status_pages carries a public select policy as well as the owner policy,
    // so the user_id filter is what keeps this from listing everyone's pages.
    const [spRes, monsRes] = await Promise.all([
      supabase
        .from("status_pages")
        .select("id, slug, title, monitor_ids")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: true })
        .limit(1),
      supabase
        .from("uptime_monitors")
        .select("id, url, label, last_status, last_checked_at")
        .order("created_at", { ascending: false }),
    ]);

    if (spRes.error || monsRes.error) {
      setLoadError(spRes.error?.message ?? monsRes.error?.message ?? "Could not load.");
      setLoading(false);
      return;
    }

    setLoadError(null);
    const row = (spRes.data?.[0] ?? null) as StatusPageRow | null;
    if (row) {
      setStatusPage(row);
      setSlug(row.slug);
      setTitle(row.title);
      setSelectedIds(new Set(row.monitor_ids || []));
    }
    setMonitors(monsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await load(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!savedMsg) return;
    const timer = setTimeout(() => setSavedMsg(null), 2000);
    return () => clearTimeout(timer);
  }, [savedMsg]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("You are signed out. Sign in again to create a status page.");
      return;
    }

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }

    setSaving(true);
    const { data, error: insertErr } = await supabase
      .from("status_pages")
      .insert({
        user_id: userId,
        slug: cleanSlug,
        title: title.trim() || "Status",
        monitor_ids: Array.from(selectedIds),
      })
      .select("id, slug, title, monitor_ids")
      .single();
    setSaving(false);

    if (insertErr) {
      setError(
        insertErr.message.includes("duplicate")
          ? "That slug is already taken."
          : insertErr.message,
      );
      return;
    }

    setStatusPage(data as StatusPageRow);
    setSlug((data as StatusPageRow).slug);
  }

  async function handleSave() {
    if (!statusPage) return;
    setError(null);
    setSaving(true);

    const { error: updateErr } = await supabase
      .from("status_pages")
      .update({
        title: title.trim() || "Status",
        monitor_ids: Array.from(selectedIds),
      })
      .eq("id", statusPage.id);

    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setStatusPage({ ...statusPage, title: title.trim() || "Status", monitor_ids: Array.from(selectedIds) });
    setSavedMsg("Saved.");
  }

  async function handleCopyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      setError("Could not copy — copy the URL manually.");
    }
  }

  function toggleMonitor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const publicPath = statusPage ? `/status/${statusPage.slug}` : null;
  const publicUrl = publicPath ? `${origin}${publicPath}` : null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Status Page</h1>
      <p className="mt-1 text-sm text-muted">
        Publish a public status page built from your Uptime Monitor checks.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : loadError ? (
        <p className="mt-6 text-sm text-danger">Could not load your status page: {loadError}</p>
      ) : !statusPage ? (
        <form onSubmit={handleCreate} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Slug</label>
            <input
              type="text"
              className="input w-full"
              placeholder="my-company"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Status"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create status page"}
          </button>
        </form>
      ) : (
        <div className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input
              type="text"
              className="input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Public URL</label>
            <div className="flex items-center gap-2">
              <a
                href={publicPath ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="input flex min-w-0 flex-1 items-center truncate text-accent hover:underline"
              >
                {publicUrl ?? publicPath}
              </a>
              <button type="button" className="btn btn-secondary shrink-0 text-xs" onClick={handleCopyUrl}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {savedMsg && <p className="mt-2 text-xs text-accent">{savedMsg}</p>}

      {!loading && !loadError && (
        <div className="mt-6">
          <h2 className="text-sm font-medium">Monitors to show</h2>
          <p className="mt-1 text-xs text-muted">
            The public page shows each monitor&apos;s last recorded check from the Uptime Monitor
            tool — it does not probe your sites on its own. Remember to save after changing the
            selection.
          </p>
          {monitors.length === 0 ? (
            <div className="card mt-3 p-6 text-center">
              <p className="text-sm text-muted">
                No monitors yet. Add some in the Uptime Monitor tool first.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {monitors.map((m) => (
                <label
                  key={m.id}
                  className="card flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggleMonitor(m.id)}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.label || m.url}</p>
                    {m.label && <p className="truncate text-xs text-muted">{m.url}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {statusPage && (
            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save selection"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
