import { BLOCKED_TARGET_MESSAGE, safeFetch } from "@/lib/safe-fetch";

/**
 * Single-monitor check logic, shared by the manual /api/uptime/check route
 * and the scheduled /api/uptime/cron route so the two can never drift apart.
 */

export type UptimeStatus = "up" | "down";

export type UptimeCheckResult = {
  status: UptimeStatus;
  statusCode: number | null;
  responseMs: number;
  checkedAt: string;
  /** Human-readable reason, currently only set when the SSRF guard blocked the URL. */
  message: string | null;
};

const TIMEOUT_MS = 10000;

/** Performs the network check. Never throws — a failure is simply "down". */
export async function runUptimeCheck(url: string): Promise<UptimeCheckResult> {
  const startedAt = Date.now();
  let status: UptimeStatus = "down";
  let statusCode: number | null = null;
  let message: string | null = null;

  try {
    const res = await safeFetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statusCode = res.status;
    // safeFetch uses redirect: "manual" to block redirect-to-internal-address
    // SSRF, so a 3xx arrives here as a response — the server is up.
    status = res.status < 400 ? "up" : "down";
  } catch (err) {
    status = "down";
    statusCode = null;
    const errMessage = err instanceof Error ? err.message : "";
    message =
      errMessage === BLOCKED_TARGET_MESSAGE
        ? "Blocked: monitor URL points to a private, local, or otherwise non-public address."
        : null;
  }

  return {
    status,
    statusCode,
    responseMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
    message,
  };
}

/**
 * Minimal structural type so this helper works with both the cookie-scoped
 * server client and the service-role admin client.
 */
type UptimeDbClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Persists a check result: appends an uptime_checks row and rolls the
 * monitor's last_checked_at / last_status forward. Returns an error message
 * on failure, or null on success.
 */
export async function recordUptimeCheck(
  supabase: UptimeDbClient,
  monitorId: string,
  result: UptimeCheckResult,
): Promise<string | null> {
  const { error: insertErr } = await supabase.from("uptime_checks").insert({
    monitor_id: monitorId,
    checked_at: result.checkedAt,
    status: result.status,
    status_code: result.statusCode,
    response_ms: result.responseMs,
  });

  if (insertErr) return insertErr.message;

  const { error: updateErr } = await supabase
    .from("uptime_monitors")
    .update({ last_checked_at: result.checkedAt, last_status: result.status })
    .eq("id", monitorId);

  if (updateErr) return updateErr.message;

  return null;
}

/** True when a monitor is due for its next check. */
export function isMonitorDue(
  lastCheckedAt: string | null,
  intervalMinutes: number,
  now: number = Date.now(),
): boolean {
  if (!lastCheckedAt) return true;
  const interval = Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 5;
  const last = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= interval * 60_000;
}
