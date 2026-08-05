"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Monitor = {
  id: string;
  url: string;
  label: string | null;
  interval_minutes: number;
  last_checked_at: string | null;
  last_status: string | null;
  created_at: string;
};

type Check = {
  monitor_id: string;
  checked_at: string;
  status: string;
  response_ms: number | null;
};

/** How many recent checks the little history strip shows. */
const HISTORY_LENGTH = 12;

function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        up
      </span>
    );
  }
  if (status === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-muted" />
      never checked
    </span>
  );
}

export default function UptimePage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check[]>>({});

  const loadMonitors = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("uptime_monitors")
      .select("id, url, label, interval_minutes, last_checked_at, last_status, created_at")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setLoadError(fetchErr.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    setLoadError(null);
    setMonitors(rows);

    if (rows.length === 0) {
      setChecks({});
      setLoading(false);
      return;
    }

    // Recent check history for the sparkline / latency figure. RLS only
    // returns checks whose monitor belongs to the signed-in user.
    const { data: checkRows } = await supabase
      .from("uptime_checks")
      .select("monitor_id, checked_at, status, response_ms")
      .in(
        "monitor_id",
        rows.map((m) => m.id),
      )
      .order("checked_at", { ascending: false })
      .limit(500);

    const grouped: Record<string, Check[]> = {};
    for (const row of (checkRows ?? []) as Check[]) {
      const list = grouped[row.monitor_id] ?? (grouped[row.monitor_id] = []);
      if (list.length < HISTORY_LENGTH) list.push(row);
    }
    setChecks(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadMonitors();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("You are signed out. Sign in again to add a monitor.");
      return;
    }

    let trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("URL is required.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    const interval = Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 5;

    setCreating(true);
    const { error: insertErr } = await supabase.from("uptime_monitors").insert({
      user_id: userId,
      url: trimmedUrl,
      label: label.trim(),
      interval_minutes: interval,
    });
    setCreating(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    setUrl("");
    setLabel("");
    setIntervalMinutes(5);
    await loadMonitors();
  }

  async function handleDelete(monitor: Monitor) {
    if (!confirm(`Delete the monitor for ${monitor.label || monitor.url}?`)) return;
    setActionError(null);
    setMonitors((prev) => prev.filter((m) => m.id !== monitor.id));
    const { error: deleteErr } = await supabase
      .from("uptime_monitors")
      .delete()
      .eq("id", monitor.id);
    if (deleteErr) {
      setActionError(`Could not delete that monitor: ${deleteErr.message}`);
      await loadMonitors();
    }
  }

  async function handleCheckNow(id: string) {
    setActionError(null);
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/uptime/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitor_id: id }),
      });
      let payload: { error?: string; message?: string } = {};
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }
      if (!res.ok) {
        setActionError(payload.error ?? "Could not run that check. Try again.");
      } else if (payload.message) {
        // e.g. the SSRF guard refused a private/local URL.
        setActionError(payload.message);
      }
      await loadMonitors();
    } catch {
      setActionError("Network error while running that check. Try again.");
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Uptime Monitor</h1>
      <p className="mt-1 text-sm text-muted">
        Monitor URLs on a schedule, or check any of them on demand.
      </p>

      <form onSubmit={handleCreate} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted">URL</label>
          <input
            type="text"
            className="input w-full"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="sm:w-40">
          <label className="mb-1 block text-xs text-muted">Label (optional)</label>
          <input
            type="text"
            className="input w-full"
            placeholder="My site"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="sm:w-32">
          <label className="mb-1 block text-xs text-muted">Interval (min)</label>
          <input
            type="number"
            min={1}
            className="input w-full"
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Adding…" : "Add monitor"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}
      <p className="mt-2 text-xs text-muted">
        Automatic checks run on one scheduled sweep per day (08:00 UTC). The interval below is the
        minimum spacing between two automatic checks of the same monitor, so anything under a day
        still only gets one automatic check per day. Use &quot;Check now&quot; whenever you want an
        immediate result.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">Could not load your monitors: {loadError}</p>
        ) : monitors.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">No monitors yet. Add a URL above to start tracking it.</p>
          </div>
        ) : (
          monitors.map((m, i) => (
            <div
              key={m.id}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="card animate-fade-in flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{m.label || m.url}</p>
                  <StatusBadge status={m.last_status} />
                </div>
                {m.label && <p className="truncate text-xs text-muted">{m.url}</p>}
                <p className="mt-0.5 text-xs text-muted">
                  every {m.interval_minutes}m · last checked {formatRelative(m.last_checked_at)}
                  {(() => {
                    const latency = (checks[m.id] ?? []).find((c) => c.response_ms !== null)
                      ?.response_ms;
                    return typeof latency === "number" ? ` · ${latency} ms` : "";
                  })()}
                </p>
                {(checks[m.id]?.length ?? 0) > 0 && (
                  <div className="mt-1.5 flex items-center gap-0.5" aria-hidden="true">
                    {[...(checks[m.id] ?? [])].reverse().map((c, ci) => (
                      <span
                        key={`${c.checked_at}-${ci}`}
                        title={`${c.status}${c.response_ms !== null ? ` · ${c.response_ms} ms` : ""} · ${formatRelative(c.checked_at)}`}
                        className={`h-3 w-1.5 rounded-sm ${
                          c.status === "up" ? "bg-accent" : "bg-danger"
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 text-[11px] text-muted">
                      last {checks[m.id]?.length} check{checks[m.id]?.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={checkingIds.has(m.id)}
                  onClick={() => handleCheckNow(m.id)}
                >
                  {checkingIds.has(m.id) ? "Checking…" : "Check now"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-danger"
                  onClick={() => handleDelete(m)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
