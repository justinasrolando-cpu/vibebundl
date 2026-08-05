import type { Metadata } from "next";
import AssetTile from "@/components/AssetTile";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { BRAND, lockupSvg, markSvg } from "@/lib/brand";
import { BUNDLE_PRICE_USD, TOOLS, TOOL_COUNT_LABEL, TOTAL_ORIGINAL_PRICE } from "@/lib/tools";

const TITLE = "Brand kit";
const BLURB =
  "Logos, avatars and the one-line description, in every size and background you'd need. Take what you want — no permission required.";

export const metadata: Metadata = {
  title: `${TITLE} — VibeBundl`,
  description: BLURB,
  openGraph: { title: `${TITLE} — VibeBundl`, description: BLURB, type: "website" },
};

/**
 * Every asset generated from src/lib/brand.ts rather than stored as a file.
 *
 * A press page is where logos go to rot: someone ships a new mark and these
 * twelve PNGs keep serving the old one for a year. Deriving them from the
 * same path data the app draws with means that can't happen — the page has
 * no copy of the logo to fall out of date.
 */
const AVATAR_NOTE = "1:1, safe inside a circular crop. Use for X, Instagram, GitHub.";

const ASSETS = [
  {
    title: "Mark — paper on ink",
    note: "The default. Use on dark backgrounds.",
    filename: "vibebundl-mark-paper-on-ink",
    previewBg: "dark" as const,
    svg: markSvg({ fg: BRAND.paper, bg: BRAND.ink, ring: BRAND.ringOnDark }),
  },
  {
    title: "Mark — ink on paper",
    note: "For light backgrounds and print.",
    filename: "vibebundl-mark-ink-on-paper",
    previewBg: "light" as const,
    svg: markSvg({ fg: BRAND.ink, bg: BRAND.paper, ring: BRAND.ringOnLight }),
  },
  {
    title: "Mark — paper, transparent",
    note: "Knockout. Put it on any dark surface, including photography.",
    filename: "vibebundl-mark-paper-transparent",
    previewBg: "transparent-dark" as const,
    svg: markSvg({ fg: BRAND.paper, bg: null }),
  },
  {
    title: "Mark — ink, transparent",
    note: "Knockout for light surfaces.",
    filename: "vibebundl-mark-ink-transparent",
    previewBg: "transparent" as const,
    svg: markSvg({ fg: BRAND.ink, bg: null }),
  },
  {
    title: "Mark — ember on ink",
    note: "The accent version. One use per surface — it's a highlight, not a second logo.",
    filename: "vibebundl-mark-ember-on-ink",
    previewBg: "dark" as const,
    svg: markSvg({ fg: BRAND.ember, bg: BRAND.ink, ring: BRAND.ringOnDark }),
  },
  {
    title: "Avatar — dark",
    note: AVATAR_NOTE,
    filename: "vibebundl-avatar-dark",
    previewBg: "dark" as const,
    svg: markSvg({ fg: BRAND.paper, bg: BRAND.ink }),
  },
  {
    title: "Avatar — light",
    note: AVATAR_NOTE,
    filename: "vibebundl-avatar-light",
    previewBg: "light" as const,
    svg: markSvg({ fg: BRAND.ink, bg: BRAND.paper }),
  },
];

const LOCKUPS = [
  {
    title: "Lockup — on ink",
    note: "Mark and wordmark. The primary signature; use this before the mark alone.",
    filename: "vibebundl-lockup-on-ink",
    previewBg: "dark" as const,
    svg: lockupSvg({ fg: BRAND.paper, bg: BRAND.ink, accent: BRAND.paper }),
  },
  {
    title: "Lockup — on paper",
    note: "The same signature for light backgrounds and print.",
    filename: "vibebundl-lockup-on-paper",
    previewBg: "light" as const,
    svg: lockupSvg({ fg: BRAND.ink, bg: BRAND.paper, accent: BRAND.ink }),
  },
  {
    title: "Lockup — transparent, paper",
    note: "Knockout, for dark surfaces you don't control.",
    filename: "vibebundl-lockup-paper-transparent",
    previewBg: "transparent-dark" as const,
    svg: lockupSvg({ fg: BRAND.paper, bg: null, accent: BRAND.paper }),
  },
  {
    title: "Lockup — transparent, ink",
    note: "Knockout, for light surfaces you don't control.",
    filename: "vibebundl-lockup-ink-transparent",
    previewBg: "transparent" as const,
    svg: lockupSvg({ fg: BRAND.ink, bg: null, accent: BRAND.ink }),
  },
];

const SWATCHES = [
  { name: "Ink", hex: BRAND.ink, note: "The ground. Every dark surface starts here." },
  { name: "Paper", hex: BRAND.paper, note: "The accent. Not a hue — that's the point." },
  { name: "Ember", hex: BRAND.ember, note: "State only. Never decoration." },
  { name: "Ember (light)", hex: BRAND.emberDark, note: "The same accent, re-solved for white." },
];

const COPY = [
  {
    label: "One line",
    text: `${TOOLS.length} small tools behind one login and one $${BUNDLE_PRICE_USD}/mo subscription.`,
  },
  {
    label: "One paragraph",
    text: `VibeBundl is ${TOOL_COUNT_LABEL} small web tools — link-in-bio, invoicing, forms, uptime monitoring, a dozen more — behind a single login and a single $${BUNDLE_PRICE_USD}/mo subscription, replacing about $${Math.round(TOTAL_ORIGINAL_PRICE)}/mo of separate SaaS. It's built from the community verdicts on canivibecodeit.com about which subscriptions were one prompt away from unnecessary.`,
  },
  { label: "Name", text: "VibeBundl — one word, capital V, capital B. Never “Vibe Bundl”." },
];

export default function PressPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="animate-fade-in mx-auto w-full max-w-5xl px-4 pt-14 pb-4 md:pt-20">
        <p className="eyebrow">Press</p>
        <h1 className="mt-3 text-3xl tracking-[var(--tracking-display)] md:text-4xl">
          Brand kit
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{BLURB}</p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-2">
          Every file here is generated from the same vector the app draws with, so nothing
          on this page can go stale. PNGs are rendered in your browser when you click —
          nothing is uploaded.
        </p>
      </div>

      <section className="mx-auto w-full max-w-5xl px-4 pt-10">
        <h2 className="text-sm tracking-tight">The mark</h2>
        <p className="mt-1 text-xs text-muted-2">
          Three bars held inside a bracket: many things collapsed into one held object.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((a) => (
            <AssetTile key={a.filename} {...a} sizes={[512, 1024]} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pt-12">
        <h2 className="text-sm tracking-tight">The lockup</h2>
        <p className="mt-1 text-xs text-muted-2">
          Mark plus wordmark. Give it clear space of at least the height of the mark on
          every side, and never set it below 96px wide.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LOCKUPS.map((a) => (
            <AssetTile key={a.filename} {...a} square={false} sizes={[1024, 2048]} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pt-12">
        <h2 className="text-sm tracking-tight">Colour</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SWATCHES.map((s) => (
            <div key={s.hex} className="card breathe overflow-hidden">
              <div className="h-20 border-b border-border" style={{ background: s.hex }} />
              <div className="p-3">
                <p className="text-xs tracking-tight">{s.name}</p>
                <p className="tnum mt-0.5 font-mono text-[0.6875rem] text-muted">{s.hex}</p>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-2">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pt-12">
        <h2 className="text-sm tracking-tight">Type</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card breathe p-5">
            <p className="eyebrow">Headings</p>
            <p className="mt-2 font-sans text-2xl font-bold tracking-[var(--tracking-display)]">
              Space Grotesk 700
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-2">
              Only on headings. Everywhere else is the mono.
            </p>
          </div>
          <div className="card breathe p-5">
            <p className="eyebrow">Everything else</p>
            <p className="mt-2 font-mono text-lg">JetBrains Mono 400</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-2">
              Nav, labels, buttons, body, tables. The inversion is the identity: a
              monospace product with a display face for the moments that shout.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pt-12">
        <h2 className="text-sm tracking-tight">Copy you can paste</h2>
        <div className="mt-4 flex flex-col gap-3">
          {COPY.map((c) => (
            <div key={c.label} className="card p-4">
              <p className="eyebrow">{c.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-2">
          One thing we&apos;d ask: don&apos;t recolour the mark outside the palette above,
          and don&apos;t set it inside another company&apos;s lockup as if we were partners.
          Everything else — resize it, crop it, put it on a slide — go ahead.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
