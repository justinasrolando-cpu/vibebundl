import Link from "next/link";
import { SPONSOR_SLOTS_TOTAL, SPONSOR_TIERS } from "@/lib/sponsors";

/**
 * The sponsor teaser — a compact pointer from the landing page to /sponsor.
 *
 * Prices are read from SPONSOR_TIERS rather than written out, so the landing
 * page can never quote a rate the sponsor page has moved off. Everything else
 * here is the same claim /sponsor makes in full: a recently-launched site,
 * flat launch pricing, and no traffic figure — because we don't have one worth
 * quoting and an invented one is the entire thing that page exists not to do.
 *
 * Deliberately not a pitch. Anyone who'd sponsor a site this new is reading
 * for the catch, and the fastest way to lose them is a paragraph implying
 * reach we can't evidence.
 */
export default function SponsorTeaser({ className = "" }: { className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-4 ${className}`}>
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-lg">
            <p className="eyebrow">Sponsor</p>
            <h2 className="title-2 mt-2">
              {SPONSOR_SLOTS_TOTAL} founding slots, priced before the traffic.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We launched recently and we have no traffic figure worth quoting, so we don&apos;t
              quote one. What&apos;s for sale is the position and a flat monthly rate that goes up
              when the numbers justify it — and never for a slot already sold.
            </p>

            <Link href="/sponsor" className="btn btn-secondary mt-6">
              see the slots and the caveats
            </Link>
          </div>

          {/* Three rates, tabular so the column reads as a price list. */}
          <dl className="grid w-full shrink-0 grid-cols-3 gap-x-5 border-t border-border pt-5 lg:w-auto lg:border-t-0 lg:pt-0">
            {SPONSOR_TIERS.map((tier) => (
              <div key={tier.id} className="lg:min-w-24">
                <dt className="eyebrow truncate">{tier.name}</dt>
                <dd className="tnum mt-1.5 text-xl font-semibold tracking-tight">
                  ${tier.monthlyPriceUsd}
                  <span className="text-sm font-normal text-muted-2">/mo</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
