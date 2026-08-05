"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type WebhookRelay = {
  id: string;
  user_id: string;
  slug: string;
  target_url: string;
  created_at: string;
};

type WebhookLog = {
  id: string;
  relay_id: string;
  payload: unknown;
  forwarded_status: number | null;
  created_at: string;
};

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function randomSlug(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
        failed
      </span>
    );
  }
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"
      }`}
    >
      {status}
    </span>
  );
}

export default function WebhooksPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [relays, setRelays] = useState<WebhookRelay[]>([]);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState(randomSlug());
  const [targetUrl, setTargetUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadRelays = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("webhook_relays")
      .select("id, user_id, slug, target_url, created_at")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setLoadError(fetchErr.message);
    } else {
      setLoadError(null);
      setRelays((data ?? []) as WebhookRelay[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadRelays();
    })();
  }, [supabase, loadRelays]);

  const loadLogs = useCallback(
    async (relayId: string) => {
      setLogsLoading(true);
      const { data, error: fetchErr } = await supabase
        .from("webhook_logs")
        .select("id, relay_id, payload, forwarded_status, created_at")
        .eq("relay_id", relayId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (fetchErr) {
        setLogsError(fetchErr.message);
        setLogs([]);
      } else {
        setLogsError(null);
        setLogs((data ?? []) as WebhookLog[]);
      }
      setLogsLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (selectedId) {
      loadLogs(selectedId);
    } else {
      setLogs([]);
    }
  }, [selectedId, loadLogs]);

  const selectedRelay = useMemo(
    () => relays.find((r) => r.id === selectedId) ?? null,
    [relays, selectedId],
  );

  const handleCreate = async () => {
    setError(null);
    if (!userId) {
      setError("You are signed out. Sign in again to create a relay.");
      return;
    }
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      setError("Slug is required.");
      return;
    }
    if (!isValidUrl(targetUrl)) {
      setError("Target URL must be a valid http:// or https:// URL.");
      return;
    }
    setCreating(true);
    const { data, error: insertErr } = await supabase
      .from("webhook_relays")
      .insert({ user_id: userId, slug: trimmedSlug, target_url: targetUrl.trim() })
      .select()
      .single();
    if (!insertErr && data) {
      setRelays((prev) => [data as WebhookRelay, ...prev]);
      setSlug(randomSlug());
      setTargetUrl("");
    } else if (insertErr) {
      setError(
        insertErr.code === "23505"
          ? "That slug is already taken. Try another."
          : insertErr.message,
      );
    }
    setCreating(false);
  };

  const handleDelete = async (relay: WebhookRelay) => {
    if (!confirm(`Delete relay "/${relay.slug}"? This cannot be undone.`)) return;
    setError(null);
    const { error: deleteErr } = await supabase.from("webhook_relays").delete().eq("id", relay.id);
    if (deleteErr) {
      setError(`Could not delete that relay: ${deleteErr.message}`);
      return;
    }
    setRelays((prev) => prev.filter((r) => r.id !== relay.id));
    if (selectedId === relay.id) setSelectedId(null);
  };

  const handleCopy = async (relay: WebhookRelay) => {
    const url = `${siteOrigin()}/api/hooks/${relay.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(relay.id);
      setTimeout(() => setCopiedId((id) => (id === relay.id ? null : id)), 1500);
    } catch {
      // clipboard not available, ignore
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Webhook Relay</h1>
        <p className="mt-1 text-sm text-muted">
          Catch a webhook at a public URL, forward it to another endpoint, and keep a log of every attempt.
        </p>
        <p className="mt-1 text-xs text-muted">
          Single hop, POST with a JSON body only. Failed forwards are logged but never retried,
          redirects are not followed, and the log shows the 50 most recent deliveries.
        </p>
      </div>

      <div className="card animate-fade-in flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold">New relay</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            className="input w-full"
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
          />
          <input
            className="input w-full"
            placeholder="https://target-endpoint.example.com/webhook"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create relay"}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <p className="text-xs text-muted">
          Your catch URL will be <code>{siteOrigin()}/api/hooks/&lt;slug&gt;</code>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="card animate-fade-in flex flex-col gap-1 p-4">
          <h2 className="mb-2 text-sm font-semibold">Relays</h2>
          {loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p className="py-4 text-sm text-danger">Could not load your relays: {loadError}</p>
          ) : relays.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No relays yet. Create one above to get a public catch URL.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {relays.map((relay) => {
                const catchUrl = `${siteOrigin()}/api/hooks/${relay.slug}`;
                return (
                  <li
                    key={relay.id}
                    className={`animate-fade-in rounded-lg border px-3 py-2 transition-colors ${
                      selectedId === relay.id
                        ? "border-accent bg-surface-hover"
                        : "border-border hover:bg-surface-hover"
                    }`}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => setSelectedId(relay.id === selectedId ? null : relay.id)}
                    >
                      <p className="truncate text-sm font-medium">/{relay.slug}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">→ {relay.target_url}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-accent">{catchUrl}</p>
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="btn btn-secondary text-xs"
                        onClick={() => handleCopy(relay)}
                      >
                        {copiedId === relay.id ? "Copied!" : "Copy URL"}
                      </button>
                      <button
                        className="btn btn-secondary text-xs text-danger"
                        onClick={() => handleDelete(relay)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card animate-fade-in flex flex-col gap-1 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {selectedRelay ? `Logs for /${selectedRelay.slug}` : "Logs"}
            </h2>
            {selectedRelay && (
              <button
                className="btn btn-secondary text-xs"
                onClick={() => loadLogs(selectedRelay.id)}
                disabled={logsLoading}
              >
                {logsLoading ? "Refreshing…" : "Refresh"}
              </button>
            )}
          </div>
          {!selectedRelay ? (
            <p className="py-4 text-sm text-muted">Select a relay on the left to see its recent webhook logs.</p>
          ) : logsLoading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : logsError ? (
            <p className="py-4 text-sm text-danger">Could not load logs: {logsError}</p>
          ) : logs.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No webhooks received yet for this relay. POST some JSON to the catch URL, then hit
              Refresh.
            </p>
          ) : (
            <ul className="flex max-h-[600px] flex-col gap-3 overflow-y-auto">
              {logs.map((log) => (
                <li key={log.id} className="animate-fade-in rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <StatusBadge status={log.forwarded_status} />
                    <span className="text-xs text-muted">{formatDate(log.created_at)}</span>
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-md bg-surface p-2 text-xs leading-relaxed text-foreground">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
