import Link from "next/link";
import {
  SPONSOR_SLOTS_TOTAL,
  SPONSOR_TIERS,
  sortedSponsors,
  type Sponsor,
} from "@/lib/sponsors";

/**
 * The sponsor placement.
 *
 * ── What changed, and why ───────────────────────────────────────────────────
 * This used to render nothing at all while `SPONSORS` was empty, on the
 * argument that a "your logo here" ghost advertises the fact that nobody is
 * advertising. That's true of a *row* of empty boxes pretending to be sold
 * inventory. It isn't true of one small card that says plainly that the space
 * is for sale — that's a price tag, not a vacancy sign, and a slot nobody can
 * see is a slot nobody buys.
 *
 * So: exactly one card when empty. Never a grid of placeholders, never a
 * mocked-up logo, never a fake sponsor. When real sponsors exist they take
 * the rail and the offer shrinks to a single trailing card at the end.
 *
 * Sponsor links carry `rel="sponsored"` because they are paid, and every card
 * says "Sponsored" out loud: a reader should never have to work out whether
 * something on the page was bought. The offer card is ours, not a sponsor's,
 * so it is deliberately *not* labelled Sponsored and carries no `rel` —
 * mislabelling our own house ad would be the same dishonesty in reverse.
 */

/** The cheapest way in. Read from the tiers so the two can never disagree. */
const FROM_PRICE = Math.min(...SPONSOR_TIERS.map((tier) => tier.monthlyPriceUsd));

export default function SponsorRail({
  variant = "inline",
  className = "",
}: {
  /** `sidebar` is the narrow, stacked form used in the dashboard rail. */
  variant?: "inline" | "sidebar";
  className?: string;
}) {
  const sponsors = sortedSponsors();
  const sidebar = variant === "sidebar";
  const empty = sponsors.length === 0;

  return (
    <aside
      aria-label={empty ? "Sponsor this page" : "Sponsors"}
      className={[sidebar ? "" : "mx-auto w-full max-w-5xl px-4", className].join(" ")}
    >
      <div className="flex items-center gap-2.5">
        <p className="eyebrow">{empty ? "This space" : "Sponsored"}</p>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        className={
          sidebar
            ? "mt-2.5 flex flex-col gap-2"
            : empty
              ? "mt-4 max-w-sm"
              : "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {sponsors.map((sponsor) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} sidebar={sidebar} />
        ))}
        <SlotCard sidebar={sidebar} empty={empty} />
      </div>
    </aside>
  );
}

function SponsorCard({ sponsor, sidebar }: { sponsor: Sponsor; sidebar: boolean }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={["card card-interactive block", sidebar ? "px-3 py-2.5" : "p-4"].join(" ")}
    >
      <span className="flex items-center gap-2">
        <span
          className={[
            "block truncate font-medium tracking-tight",
            sidebar ? "text-[0.8125rem]" : "text-sm",
          ].join(" ")}
        >
          {sponsor.name}
        </span>
        {sponsor.tier === "top" && (
          <span className="chip chip-accent shrink-0 text-[0.625rem]">Partner</span>
        )}
        {/* Per card, not just once above the rail — a card can be screenshotted,
            linked to, or read on its own, and it has to be honest on its own. */}
        <span className="eyebrow ml-auto shrink-0 text-[0.5625rem]">Sponsored</span>
      </span>
      <span
        className={[
          "mt-1 block leading-relaxed text-muted-2",
          sidebar ? "line-clamp-2 text-[0.6875rem]" : "text-xs",
        ].join(" ")}
      >
        {sponsor.tagline}
      </span>
    </a>
  );
}

/**
 * The offer. Dashed rather than solid so it reads as an opening in the layout
 * instead of a filled one, and it never grows past a single card — the whole
 * point is that it looks like one slot for sale, not like a rail of them
 * failing to sell.
 */
function SlotCard({ sidebar, empty }: { sidebar: boolean; empty: boolean }) {
  return (
    <Link
      href="/sponsor"
      className={[
        "card card-interactive block border-dashed border-border-strong bg-transparent",
        sidebar ? "px-3 py-2.5" : "p-4",
      ].join(" ")}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-accent" aria-hidden>
          +
        </span>
        <span
          className={[
            "block truncate font-medium tracking-tight",
            sidebar ? "text-[0.8125rem]" : "text-sm",
          ].join(" ")}
        >
          {empty ? "add your sponsor" : "one more slot"}
        </span>
      </span>
      <span
        className={[
          "mt-1 block leading-relaxed text-muted-2",
          sidebar ? "line-clamp-2 text-[0.6875rem]" : "text-xs",
        ].join(" ")}
      >
        {sidebar
          ? `Sponsor this page from $${FROM_PRICE}/mo`
          : `Sponsor this page from $${FROM_PRICE}/mo. ${SPONSOR_SLOTS_TOTAL} founding slots, flat monthly rate.`}
      </span>
    </Link>
  );
}
