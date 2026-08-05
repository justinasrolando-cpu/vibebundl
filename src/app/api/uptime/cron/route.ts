import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMonitorDue, recordUptimeCheck, runUptimeCheck } from "@/lib/uptime";

/**
 * Scheduled uptime sweep. Invoked by Vercel Cron (see vercel.json), which
 * issues a GET with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * There is no user session in a cron run, so this uses the service-role admin
 * client — which means the CRON_SECRET check is the only thing standing
 * between the internet and every monitor in the database. It fails closed: if
 * CRON_SECRET is unset, every request is rejected.
 */

export const dynamic = "force-dynamic";

/** Hard cap on monitors checked per run so one invocation can't hang. */
const BATCH_LIMIT = 50;
/** Candidate rows pulled before the per-monitor interval filter runs. */
const CANDIDATE_LIMIT = 200;
/** How many checks run at once. */
const CONCURRENCY = 5;
/** Smallest interval any monitor can have, in minutes. */
const MIN_INTERVAL_MINUTES = 1;

type MonitorRow = {
  id: string;
  url: string;
  interval_minutes: number;
  last_checked_at: string | null;
};

/** Length-independent comparison so the secret can't be probed byte by byte. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      // Fail closed — never run this open to the internet.
      return NextResponse.json(
        { error: "Not authorized." },
        { status: 401 },
      );
    }

    const header = req.headers.get("authorization") ?? "";
    if (!secretsMatch(header, `Bearer ${secret}`)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = Date.now();

    // Coarse filter in SQL (nothing checked within the shortest possible
    // interval can be due), then the exact per-monitor interval test in JS,
    // since each row carries its own interval_minutes.
    const coarseCutoff = new Date(now - MIN_INTERVAL_MINUTES * 60_000).toISOString();

    const { data, error } = await supabase
      .from("uptime_monitors")
      .select("id, url, interval_minutes, last_checked_at")
      .or(`last_checked_at.is.null,last_checked_at.lt.${coarseCutoff}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(CANDIDATE_LIMIT);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const due = ((data ?? []) as MonitorRow[])
      .filter((m) => isMonitorDue(m.last_checked_at, m.interval_minutes, now))
      .slice(0, BATCH_LIMIT);

    let up = 0;
    let down = 0;

    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const slice = due.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (monitor) => {
          const result = await runUptimeCheck(monitor.url);
          await recordUptimeCheck(supabase, monitor.id, result);
          return result.status;
        }),
      );
      for (const status of results) {
        if (status === "up") up++;
        else down++;
      }
    }

    return NextResponse.json({ checked: due.length, up, down });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
