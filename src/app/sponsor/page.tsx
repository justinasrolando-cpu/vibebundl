import type { Metadata } from "next";
import Link from "next/link";
import PublicNumbers from "@/components/PublicNumbers";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  SPONSOR_CONTACT_EMAIL,
  SPONSOR_SLOTS_TOTAL,
  SPONSOR_TIERS,
  type SponsorTier,
} from "@/lib/sponsors";
import { TOOL_COUNT_LABEL } from "@/lib/tools";

const TITLE = "Sponsor VibeBundl";
const BLURB = `${SPONSOR_SLOTS_TOTAL} founding sponsor slots on a site that just launched. No traffic numbers, because we don't have any worth quoting yet — flat launch pricing and the real figures every month instead.`;

export const metadata: Metadata = {
  title: TITLE,
  description: BLURB,
  openGraph: { title: TITLE, description: BLURB, type: "website" },
  twitter: { card: "summary", title: TITLE, description: BLURB },
};

const MAILTO = `mailto:${SPONSOR_CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Founding sponsor slot",
)}&body=${encodeURIComponent(
  "Company:\nURL:\nTier you're interested in (Standard / Featured / Top of rail):\nAnything you want to know first:\n",
)}`;

/** Where a bought slot actually appears. Every one of these exists today. */
const PLACEMENTS = [
  {
    title: "The landing page rail",
    body: "Below the fold on vibebundl.com, in the same column as the pricing and the catalogue.",
  },
  {
    title: "The dashboard sidebar",
    body: "Under the tool nav, on every page of the app. Signed-in customers, not passers-by.",
  },
  {
    title: "A link that says what it is",
    body: "Cards are labelled Sponsored and carry rel=\"sponsored\". We are not going to disguise your ad as an endorsement, which is also why nobody will bounce off it feeling tricked.",
  },
];

const TIMELINE = [
  {
    step: "You email us",
    body: "Tell us the company, the URL, and which tier. No form, no call, no deck.",
  },
  {
    step: "We reply within two working days",
    body: "With a plain answer on fit. If your product doesn't suit the audience we'll say so rather than take the money.",
  },
  {
    step: "The slot goes live",
    body: "Same week. Name, one line of copy, and a link — you send them, we ship them.",
  },
  {
    step: "You get the real numbers, monthly",
    body: "The same public counts you can see on this page, sent to you rather than looked up — and we'll tell you plainly if they haven't moved. Cancel any month, for any reason.",
  },
];

export default function SponsorPage() {
  return (
    <main className="flex-1">
      <SiteHeader />

      {/* ---------------- Hero ---------------- */}
      <div className="relative isolate overflow-hidden">
        <div className="aura" aria-hidden />
        <div className="grid-lines" aria-hidden />

        <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-14 md:pt-20 md:pb-16">
          <p className="animate-fade-in chip font-mono">
            <span className="text-accent">$</span>
            <span>
              {SPONSOR_SLOTS_TOTAL} slots · launch pricing
            </span>
          </p>

          <h1 className="animate-fade-in display mt-6 max-w-2xl">
            Founding sponsor slots.
            <span className="mt-3 block text-[0.62em] leading-[1.1] text-muted">
              Sold on honesty, not on numbers.
            </span>
          </h1>

          <p className="animate-fade-in lede mt-6 max-w-lg" style={{ animationDelay: "40ms" }}>
            VibeBundl launched recently. We have no meaningful traffic yet, and we&apos;re not
            going to invent a figure to charge you against. What we can sell you is the position,
            the price, and the truth about both.
          </p>

          <div
            className="animate-fade-in mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "80ms" }}
          >
            <a href={MAILTO} className="btn btn-primary btn-lg">
              Email us about a slot
            </a>
            <a href="#tiers" className="btn btn-secondary btn-lg">
              See the tiers
            </a>
          </div>

          <p className="animate-fade-in mt-4 text-xs text-muted-2" style={{ animationDelay: "120ms" }}>
            {SPONSOR_CONTACT_EMAIL} · no payment flow, no contract minimum
          </p>
        </section>
      </div>

      {/* ---------------- The honesty section ---------------- */}
      <section className="mx-auto w-full max-w-5xl px-4">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <div>
            <p className="eyebrow">Read this first</p>
            <h2 className="title-1 mt-2 max-w-sm">
              What we can&apos;t tell you.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Sponsorship pages usually open with a traffic figure. Ours can&apos;t, because ours
              would be a guess dressed up as a metric — and a sponsor who buys against a guess has
              bought nothing.
            </p>
            <ul className="mt-5 flex flex-col gap-3 text-sm text-muted">
              <Cant>
                No monthly pageviews. We haven&apos;t been live long enough for the number to mean
                anything, so we don&apos;t quote it.
              </Cant>
              <Cant>
                No impression estimates, no &ldquo;reach&rdquo;, no projections. Every one of those
                would be arithmetic on a number we just told you we don&apos;t have.
              </Cant>
              <Cant>
                No audience demographics. We don&apos;t track our visitors closely enough to
                describe them to you, and we&apos;d rather keep it that way.
              </Cant>
            </ul>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
              What you&apos;re buying at these prices is the early position and the discount that
              comes with the uncertainty. If the traffic never arrives, you cancel and you&apos;re
              out one month. If it does, you were first and you locked the rate.
            </p>
          </div>

          <PublicNumbers />
        </div>
      </section>

      {/* ---------------- Tiers ---------------- */}
      <section id="tiers" className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl scroll-mt-20 px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The slots</p>
            <h2 className="title-1 mt-2">{SPONSOR_SLOTS_TOTAL} in total. That&apos;s the ceiling.</h2>
          </div>
          <p className="max-w-xs text-xs text-muted-2 sm:text-right">
            Launch pricing — placeholder rates set before we had traffic to price against. They go
            up when the numbers justify it, and never for a slot already sold.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {SPONSOR_TIERS.map((tier, i) => (
            <TierCard key={tier.id} tier={tier} featured={tier.id === "top"} index={i} />
          ))}
        </div>
      </section>

      {/* ---------------- Placements ---------------- */}
      <section className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4">
        <p className="eyebrow">Where it goes</p>
        <h2 className="title-1 mt-2 max-w-lg">
          Three places, all of them already built.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          The rail is live in the codebase and renders nothing while it&apos;s empty — no
          &ldquo;your logo here&rdquo; ghosts. The day a slot sells, the card appears.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLACEMENTS.map((placement, i) => (
            <article key={placement.title} className="card p-5">
              <span className="tnum font-mono text-xs text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[0.9375rem] font-semibold tracking-tight">
                {placement.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{placement.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Timeline ---------------- */}
      <section className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4">
        <p className="eyebrow">How it goes</p>
        <h2 className="title-1 mt-2 max-w-lg">From email to live in a week.</h2>

        <ol className="card mt-8 flex flex-col overflow-hidden">
          {TIMELINE.map((item, i) => (
            <li
              key={item.step}
              className={`flex gap-4 p-5 sm:gap-6 sm:p-6 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="tnum mt-0.5 shrink-0 font-mono text-xs text-muted-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">{item.step}</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- Closing ---------------- */}
      <section className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4">
        <div className="card relative isolate flex flex-col items-center overflow-hidden px-6 py-14 text-center">
          <div className="aura opacity-50" aria-hidden />
          <p className="font-mono text-xs text-accent">
            <span className="text-muted-2">$</span> mail {SPONSOR_CONTACT_EMAIL}
          </p>
          <h2 className="title-1 mt-4 max-w-lg">Be the first name in the rail.</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Tell us the company, the URL, and the tier. We&apos;ll reply with a straight answer on
            whether it&apos;s worth your money yet.
          </p>
          <a href={MAILTO} className="btn btn-primary btn-lg mt-7">
            Email {SPONSOR_CONTACT_EMAIL}
          </a>
          <p className="mt-5 text-xs text-muted-2">
            Not a sponsor?{" "}
            <Link href="/" className="text-muted underline underline-offset-2 hover:text-foreground">
              The bundle is {TOOL_COUNT_LABEL} tools for one bill
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Cant({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function TierCard({
  tier,
  featured,
  index,
}: {
  tier: SponsorTier;
  featured: boolean;
  index: number;
}) {
  return (
    <article
      className={`animate-fade-in flex flex-col p-6 ${featured ? "card card-raised" : "card"}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{tier.name}</h3>
        <span className="tnum chip font-mono text-muted-2">
          {tier.slots} {tier.slots === 1 ? "slot" : "slots"}
        </span>
      </div>

      <p className="tnum mt-4 font-sans text-3xl font-bold tracking-tight">
        <span className={featured ? "text-gradient" : undefined}>${tier.monthlyPriceUsd}</span>
        <span className="text-sm font-normal text-muted-2">/mo</span>
      </p>
      <p className="mt-1 text-[0.6875rem] text-muted-2">launch pricing · placeholder rate</p>

      <p className="mt-4 text-sm leading-relaxed text-muted">{tier.summary}</p>

      <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-muted">
        {tier.includes.map((line) => (
          <li key={line} className="flex gap-2.5">
            <svg
              viewBox="0 0 24 24"
              width={13}
              height={13}
              className="mt-1 shrink-0 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            <span className="leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>

      <a
        href={MAILTO}
        className={`btn mt-6 ${featured ? "btn-primary" : "btn-secondary"}`}
      >
        Ask about {tier.name}
      </a>
    </article>
  );
}
