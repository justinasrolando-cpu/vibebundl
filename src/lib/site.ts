/**
 * The handful of facts about *us* rather than about the product.
 *
 * These are separated from the catalogue and the design system because they
 * are the things most likely to be edited by a human in a hurry — a handle
 * changes, an inbox moves — and they should never require reading a
 * component to find.
 */

/** The X handle shown in the footer credit. No leading @ — the UI adds it. */
export const BUILDER_HANDLE = "JustinasRoland0";

export const BUILDER_URL = `https://x.com/${BUILDER_HANDLE}`;

/**
 * Drop a square photo at `public/builder.jpg` and it appears in the footer
 * credit. Until then the credit renders a monogram in the same circle, which
 * is a deliberate design and not a broken-image state — see BuiltBy.
 */
export const BUILDER_AVATAR = "/builder.jpg";

/** Where sponsor and support mail lands. Routed through Cloudflare Email. */
export const CONTACT_EMAIL = "hello@vibebundl.com";

export const GITHUB_URL = "https://github.com/justinasrolando/vibebundl";

/**
 * The country whose law governs the Terms, and whose courts have
 * jurisdiction. This should be where the business is actually established —
 * it is the one line in the Terms that a lawyer would look at first, and
 * getting it wrong makes the rest of the document weaker, not just wrong.
 */
export const JURISDICTION = "Spain";

/** Where "we" are, for the Terms and for any time we quote an hour. */
export const JURISDICTION_CITY = "Madrid";
export const TIMEZONE = "Europe/Madrid";
