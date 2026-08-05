import ToolIcon from "@/components/ToolIcon";
import SavingsBand from "@/components/SavingsBand";
import ReplacedTicker from "@/components/ReplacedTicker";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SponsorRail from "@/components/SponsorRail";
import SponsorTeaser from "@/components/SponsorTeaser";
import Link from "next/link";
import {
  TOOLS,
  BUNDLE_PRICE_USD,
  TOTAL_ORIGINAL_PRICE,
  TOOL_COUNT_LABEL,
  groupToolsByCategory,
  type Tool,
} from "@/lib/tools";

const SAVINGS = TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD;
const SAVINGS_PCT = Math.round((SAVINGS / TOTAL_ORIGINAL_PRICE) * 100);

/** Tools that cost more on their own than the entire bundle. */
const OVERPRICED = TOOLS.filter((t) => t.originalPrice > BUNDLE_PRICE_USD);
/** The six worst offenders — they carry the "what's inside" story. */
const HEADLINERS = [...TOOLS].sort((a, b) => b.originalPrice - a.originalPrice).slice(0, 6);
/** How many bundles the single priciest subscription would buy. */
const PRICIEST_MULTIPLE = (HEADLINERS[0].originalPrice / BUNDLE_PRICE_USD).toFixed(1);

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Short, capped entrance stagger. Long cascades read as slow, not premium. */
function stagger(i: number, step = 25, cap = 150) {
  return { animationDelay: `${Math.min(i * step, cap)}ms` };
}

export default function Home() {
  const groups = groupToolsByCategory();

  return (
    <main className="flex-1">
      <SiteHeader variant="landing" />

      {/* ---------------- Hero ---------------- */}
      <div className="relative isolate overflow-hidden">
        <div className="aura" aria-hidden />
        <div className="grid-lines" aria-hidden />

        <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-10 md:pt-24 md:pb-12">
          <p className="animate-fade-in chip font-mono">
            <span className="text-attribution">$</span>
            <span>
              built from the death list at{" "}
              <a
                href="https://canivibecodeit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline decoration-border-strong underline-offset-2 transition-colors hover:decoration-attribution"
              >
                canivibecodeit.com
              </a>
            </span>
            <span className="caret text-attribution" aria-hidden>
              ▍
            </span>
          </p>

          <h1 className="animate-fade-in display mt-6 max-w-2xl" style={stagger(1, 40)}>
            <span className="text-gradient tnum">{TOOL_COUNT_LABEL}</span> subscriptions you were
            told you could vibecode away.
            {/* Subordinate size, not just subordinate colour — the punchline
                should land after the claim, not compete with it. */}
            <span className="mt-3 block text-[0.62em] leading-[1.1] text-muted">
              So we did.
            </span>
          </h1>

          <p className="animate-fade-in lede mt-6 max-w-md" style={stagger(2, 40)}>
            One login. One bill. Every tool we add is included — and{" "}
            <Link
              href="/request"
              className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-accent"
            >
              you pick what we build next
            </Link>
            .
          </p>

          <div
            className="animate-fade-in mt-8 flex flex-wrap items-center gap-3"
            style={stagger(3, 40)}
          >
            <Link href="/login?checkout=1" className="btn btn-primary btn-lg">
              get all {TOOL_COUNT_LABEL} — ${BUNDLE_PRICE_USD}/mo
            </Link>
            <a href="#tools" className="btn btn-secondary btn-lg">
              see what&apos;s inside
            </a>
          </div>

          <p className="animate-fade-in mt-4 text-xs text-muted-2" style={stagger(4, 40)}>
            cancel whenever you feel like it
          </p>
        </section>
      </div>

      {/* ---------------- The savings figure ----------------
          The first thing after the headline, and the biggest number on the
          site. It used to sit halfway down behind a three-up stat rail that
          said the same thing smaller — the rail is gone, because the band now
          carries the arithmetic in full.

          The headline figure paints with the document (it's arithmetic on
          src/lib/tools.ts, no database involved); only the live counts wait on
          the RPC. See SavingsBand for why nothing here is ever seeded. */}
      <SavingsBand />

      {/* ---------------- The bill, scrolling past ----------------
          Directly under the savings figure because it is the evidence for
          it: the number above is the sum of the line items below. Every name
          and price is read out of the catalogue, so the band cannot overstate
          what we actually replace. */}
      {/* No top margin: SavingsBand already carries a full section gap below
          itself, and stacking a second one leaves a hole the band reads as
          having fallen out of. */}
      <ReplacedTicker />

      {/* ---------------- Sponsor slot ----------------
          One card while nothing is sold, saying so plainly. Never a row of
          placeholders — see SponsorRail. */}
      <SponsorRail className="pb-[var(--section-gap)]" />

      {/* ---------------- The receipt ---------------- */}
      <section id="pricing" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4">
        <div className="card-raised relative isolate overflow-hidden p-6 sm:p-10">
          <div className="aura opacity-50" aria-hidden />

          <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-center">
            <div>
              <p className="eyebrow">The math</p>
              <h2 className="title-1 mt-2 max-w-md">
                You&apos;re not paying for software. You&apos;re paying {TOOLS.length} invoices.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
                {OVERPRICED.length} of the {TOOLS.length} cost more on their own than this entire
                bundle. The worst offender is {PRICIEST_MULTIPLE}× the price of everything here —
                by itself.
              </p>
              <Link href="/login?checkout=1" className="btn btn-primary btn-lg mt-7">
                start now — ${BUNDLE_PRICE_USD}/mo
              </Link>
            </div>

            {/* The receipt sits inset in the panel — a darker well inside a lit surface. */}
            <div className="card p-5 font-mono text-sm sm:p-6">
              <ReceiptRow
                label={`${TOOLS.length} subscriptions`}
                value={`${usd(TOTAL_ORIGINAL_PRICE)}/mo`}
                strike
              />
              <ReceiptRow
                label="VibeBundl"
                value={`${usd(BUNDLE_PRICE_USD)}/mo`}
                accent
              />

              <div className="mt-4 border-t border-dashed border-border-strong pt-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">You keep</p>
                    <p className="tnum mt-1 font-sans text-5xl font-semibold tracking-tight">
                      <span className="text-gradient">${Math.round(SAVINGS)}</span>
                      <span className="text-lg font-normal text-muted-2">/mo</span>
                    </p>
                  </div>
                  <span className="chip chip-accent mb-1.5 font-sans">{SAVINGS_PCT}% off</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Headliners ---------------- */}
      <section className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The expensive ones</p>
            <h2 className="title-1 mt-2">Start with the ones that hurt.</h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs text-muted-2 sm:block">
            The six priciest subscriptions on the list. In the bundle. At no extra charge.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HEADLINERS.map((tool, i) => (
            <article
              key={tool.slug}
              style={
                {
                  ...stagger(i, 30),
                  /* Out of phase, so the row drifts rather than pulsing as one. */
                  "--breathe-delay": `${i * 900}ms`,
                } as React.CSSProperties
              }
              className="card breathe animate-fade-in flex flex-col p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="icon-tile icon-tile-lg" aria-hidden>
                  <ToolIcon slug={tool.slug} />
                </span>
                <span className="tnum chip font-mono text-muted-2 line-through">
                  ${tool.originalPrice}/mo
                </span>
              </div>
              <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-tight">{tool.name}</h3>
              <p className="mt-0.5 text-xs text-muted-2">replaces {tool.replaces}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{tool.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Full catalogue ---------------- */}
      <section
        id="tools"
        className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl scroll-mt-20 px-4"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The whole list</p>
            <h2 className="title-1 mt-2">
              All {TOOLS.length}, grouped the way you&apos;d actually use them.
            </h2>
          </div>
          <p className="tnum hidden text-right font-mono text-xs text-muted-2 sm:block">
            {groups.length} categories
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-12">
          {groups.map((group, gi) => {
            const groupTotal = group.tools.reduce((sum, t) => sum + t.originalPrice, 0);
            return (
              <div key={group.category}>
                <div className="flex items-center gap-3">
                  <span className="tnum font-mono text-xs text-accent">
                    {String(gi + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{group.category}</h3>
                  <span className="hidden h-px flex-1 bg-border sm:block" />
                  <span className="tnum font-mono text-xs text-muted-2">
                    {group.tools.length} tools · ${Math.round(groupTotal)}/mo
                  </span>
                </div>

                <ul className="card mt-4 grid grid-cols-1 overflow-hidden md:grid-cols-2">
                  {group.tools.map((tool, i) => (
                    <ToolRow key={tool.slug} tool={tool} index={i} count={group.tools.length} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Closing ---------------- */}
      <section className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4">
        <div className="card relative isolate flex flex-col items-center overflow-hidden px-6 py-14 text-center">
          <div className="aura opacity-50" aria-hidden />
          <p className="font-mono text-xs text-accent">
            <span className="text-muted-2">$</span> npx cancel-everything
          </p>
          <h2 className="title-1 mt-4 max-w-lg">
            {TOOL_COUNT_LABEL} tools. One login. ${BUNDLE_PRICE_USD} a month.
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            Everything above, unlocked the second you sign up. No per-tool upsells, no seats, no
            &ldquo;contact sales.&rdquo;
          </p>
          <Link href="/login?checkout=1" className="btn btn-primary btn-lg mt-7">
            Get the bundle
          </Link>
        </div>
      </section>

      {/* The rail is at the top of the page; this is the price list behind it,
          placed where someone who has read the whole page might act on it. */}
      <SponsorTeaser className="mt-[var(--section-gap)]" />

      <SiteFooter />
    </main>
  );
}

function ReceiptRow({
  label,
  value,
  strike,
  accent,
}: {
  label: string;
  value: string;
  strike?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={accent ? "text-foreground" : "text-muted"}>{label}</span>
      <span className="min-w-4 flex-1 border-b border-dashed border-border" />
      <span
        className={[
          "tnum shrink-0",
          strike ? "text-muted-2 line-through" : "",
          accent ? "text-accent" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function ToolRow({ tool, index, count }: { tool: Tool; index: number; count: number }) {
  // Hairlines: a top rule on every row except the first of each column, and a
  // column rule that never dangles past the last populated cell.
  const classes = [
    "border-t border-border",
    index === 0 ? "border-t-0" : "",
    index === 1 ? "md:border-t-0" : "",
    index % 2 === 0 && index !== count - 1 ? "md:border-r md:border-border" : "",
  ];

  return (
    <li className={classes.join(" ")}>
      {/* The row is a link now: every tool has a page answering what it
          costs, what it covers and what you give up. Someone scanning this
          list for one specific product is exactly who that page is for. */}
      <Link
        href={`/tools/${tool.slug}`}
        className="group flex items-center gap-3 px-4 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-surface-hover"
      >
        <span className="icon-tile" aria-hidden>
          <ToolIcon slug={tool.slug} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium tracking-tight">{tool.name}</span>
          <span className="block truncate text-xs text-muted-2">replaces {tool.replaces}</span>
        </span>
        {tool.originalPrice > 0 && (
          <span className="tnum shrink-0 font-mono text-xs text-muted-2 line-through">
            ${tool.originalPrice}
          </span>
        )}
        <span
          aria-hidden
          className="shrink-0 text-xs text-muted-2 opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100"
        >
          →
        </span>
      </Link>
    </li>
  );
}
