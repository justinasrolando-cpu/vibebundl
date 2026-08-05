/**
 * Sponsors — the data behind `<SponsorRail />` and `/sponsor`.
 *
 * One module so there is exactly one place to look when a slot is sold, and
 * exactly one place the rail reads from.
 *
 * `SPONSORS` is empty and hardcoded on purpose: nothing is signed yet, and
 * this file is where the first signed slot gets typed in. It never holds a
 * sample, a demo, or a "coming soon" entry — a fake sponsor is a lie about a
 * commercial relationship, and the rail has its own way of showing that the
 * space is open (see SponsorRail: one honest "add your sponsor" card, not a
 * row of ghost boxes).
 *
 * TODO: when the first slot is sold, swap this constant for a read of a
 * `sponsors` table (name, url, tagline, tier, starts_at, ends_at, active) and
 * keep this module as the type + tier source of truth. Nothing downstream
 * should need to change: the rail already handles the empty case, so the
 * table returning zero rows behaves identically to today.
 */

export type SponsorTierId = "standard" | "featured" | "top";

export type Sponsor = {
  /** Stable key. Once this comes from a table, the row id. */
  id: string;
  name: string;
  /** One line, sentence case, no exclamation marks. Shown under the name. */
  tagline: string;
  url: string;
  tier: SponsorTierId;
};

/** No sponsors yet. Only ever add a slot that someone has actually bought. */
export const SPONSORS: Sponsor[] = [];

export type SponsorTier = {
  id: SponsorTierId;
  name: string;
  slots: number;
  monthlyPriceUsd: number;
  /** The one-sentence pitch for this tier. */
  summary: string;
  includes: string[];
};

/**
 * Launch pricing. Deliberately flat monthly rates rather than CPM: we can't
 * quote a CPM we don't have impressions for, and pretending otherwise would
 * be the fraud this page exists not to commit.
 */
export const SPONSOR_TIERS: SponsorTier[] = [
  {
    id: "standard",
    name: "Standard",
    slots: 4,
    monthlyPriceUsd: 99,
    summary: "A card in the rail, on the landing page and inside the app.",
    includes: [
      "One card in the sponsor rail",
      "Landing page + dashboard sidebar",
      "Name, one-line tagline, and a link",
      "Cancel with 30 days' notice",
    ],
  },
  {
    id: "featured",
    name: "Featured",
    slots: 4,
    monthlyPriceUsd: 149,
    summary: "Everything in Standard, placed above it and given more room.",
    includes: [
      "Everything in Standard",
      "Placed above the Standard slots",
      "Two lines of copy instead of one",
      "A mention in the monthly changelog post",
    ],
  },
  {
    id: "top",
    name: "Top of rail",
    slots: 2,
    monthlyPriceUsd: 199,
    summary: "The first thing in the rail, on every page the rail appears on.",
    includes: [
      "Everything in Featured",
      "First position, above every other slot",
      "Named on the /sponsor page itself",
      "First refusal on renewal",
    ],
  },
];

export const SPONSOR_SLOTS_TOTAL = SPONSOR_TIERS.reduce((sum, t) => sum + t.slots, 0);

export const SPONSOR_CONTACT_EMAIL = "hello@vibebundl.com";

/** Tier order in the rail: top first, then featured, then standard. */
const TIER_RANK: Record<SponsorTierId, number> = { top: 0, featured: 1, standard: 2 };

export function sortedSponsors(sponsors: Sponsor[] = SPONSORS): Sponsor[] {
  return [...sponsors].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
}
