"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The public numbers, straight from the `public_stats()` security-definer RPC.
 *
 * The RPC returns counts only — never a row, an email, or a customer id — and
 * deliberately returns *subscription-months* rather than a dollar figure. The
 * catalogue price lives in `src/lib/tools.ts`; multiplying in SQL would mean
 * two copies of the same number, and two copies drift.
 *
 * Fetched client-side so the figures are current on every visit rather than
 * frozen into a build. Every consumer treats `error` as "render nothing":
 * a stats band that can't prove its number has no business showing one.
 */

export type PublicStats = {
  activeSubscribers: number;
  /** Whole months of active subscription across all customers. */
  subscriptionMonths: number;
  toolRequests: number;
  toolsShippedFromRequests: number;
};

export type PublicStatsState =
  | { status: "loading"; stats: null }
  | { status: "error"; stats: null }
  | { status: "ready"; stats: PublicStats };

/** PostgREST hands `bigint`/`numeric` back as either a number or a string. */
function toNum(value: unknown): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function usePublicStats(): PublicStatsState {
  const [state, setState] = useState<PublicStatsState>({ status: "loading", stats: null });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data, error } = await supabase.rpc("public_stats");
      if (cancelled) return;

      // `returns table(...)` arrives as an array of one row.
      const row = Array.isArray(data) ? data[0] : data;

      if (error || !row) {
        setState({ status: "error", stats: null });
        return;
      }

      setState({
        status: "ready",
        stats: {
          activeSubscribers: toNum(row.active_subscribers),
          subscriptionMonths: toNum(row.subscription_months),
          toolRequests: toNum(row.tool_requests_count),
          toolsShippedFromRequests: toNum(row.tools_shipped_from_requests),
        },
      });
    })().catch(() => {
      if (!cancelled) setState({ status: "error", stats: null });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
