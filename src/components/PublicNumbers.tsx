"use client";

import { usePublicStats } from "@/components/usePublicStats";
import { TOOLS } from "@/lib/tools";

/**
 * Every number we actually have, on one card.
 *
 * Read live from `public_stats()` so a sponsor is looking at the same figures
 * we are, on the day they look. Nothing here is estimated, extrapolated, or
 * rounded up, and there is deliberately no traffic figure — see the copy on
 * /sponsor for why inventing one would be fraud rather than marketing.
 */
export default function PublicNumbers() {
  const { status, stats } = usePublicStats();

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Every number we have</p>
        <p className="text-[0.6875rem] text-muted-2">read live, on this page load</p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
        <Cell label="Tools in the bundle" value={String(TOOLS.length)} ready />
        <Cell
          label="Paying subscribers"
          value={stats ? stats.activeSubscribers.toLocaleString("en-US") : "—"}
          ready={status === "ready"}
          loading={status === "loading"}
        />
        <Cell
          label="Tool requests"
          value={stats ? stats.toolRequests.toLocaleString("en-US") : "—"}
          ready={status === "ready"}
          loading={status === "loading"}
        />
        <Cell
          label="Shipped from requests"
          value={stats ? stats.toolsShippedFromRequests.toLocaleString("en-US") : "—"}
          ready={status === "ready"}
          loading={status === "loading"}
        />
      </dl>

      <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-2">
        {status === "error"
          ? "The live counts aren't loading right now — ask us and we'll send you a screenshot of the same query."
          : "There is no pageview, impression, or reach figure on this page. We have not been live long enough to have one worth quoting, and quoting one anyway is how sponsors get sold nothing."}
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  ready,
  loading = false,
}: {
  label: string;
  value: string;
  ready: boolean;
  loading?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="tnum mt-1.5 text-2xl font-semibold tracking-tight"
        aria-busy={loading || undefined}
      >
        {loading ? <span className="text-muted-2">…</span> : ready ? value : "—"}
      </dd>
    </div>
  );
}
