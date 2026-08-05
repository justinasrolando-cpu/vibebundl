/**
 * The logo, as data.
 *
 * The mark exists three times in this repo — as a React component
 * (components/Logo.tsx), as a favicon (app/icon.svg) and here. That's
 * deliberate rather than sloppy: each has a different job and none of them
 * can import the others. The favicon must be a static file Next can hash,
 * the component must accept `currentColor` so it follows the accent, and
 * these need to be *strings*, because you cannot hand a React element to a
 * download link or paint it onto a canvas.
 *
 * What keeps them honest is that the path data below is copied verbatim from
 * Logo.tsx. Change the geometry there and change it here in the same commit.
 */

export type MarkOptions = {
  /** The bracket and bars. */
  fg: string;
  /** The rounded square behind them. `null` = transparent. */
  bg: string | null;
  /** Hairline around the tile. `null` = none. */
  ring?: string | null;
  size?: number;
};

const PATHS = [
  // the binding bracket
  "M10 8.5H8.6A1.6 1.6 0 0 0 7 10.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10",
  "M22 8.5h1.4A1.6 1.6 0 0 1 25 10.1v11.8a1.6 1.6 0 0 1-1.6 1.6H22",
  // three bundled items, shortest on top
  "M13 11.8h5",
  "M13 16h6",
  "M13 20.2h4",
];

/** The mark alone, on a 32×32 grid scaled to `size`. */
export function markSvg({ fg, bg, ring = null, size = 512 }: MarkOptions): string {
  const tile = bg ? `<rect width="32" height="32" rx="8" fill="${bg}"/>` : "";
  const hairline = ring
    ? `<rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="${ring}" stroke-width="1"/>`
    : "";
  const strokes = PATHS.map((d) => `<path d="${d}"/>`).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">`,
    tile,
    hairline,
    `<g fill="none" stroke="${fg}" stroke-width="2.1" stroke-linecap="round">${strokes}</g>`,
    `</svg>`,
  ].join("");
}

/**
 * Mark + wordmark, laid out horizontally.
 *
 * The wordmark is set in the display face with a `font-family` stack rather
 * than converted to outlines. Outlines would guarantee identical rendering
 * everywhere, which is the usual argument for them — but this file is also
 * what a press kit hands to someone who wants to *edit* the lockup, and text
 * they can retype beats a path they can only scale. The stack falls back
 * through the system sans, so it degrades to something close rather than to
 * Times.
 */
export function lockupSvg({
  fg,
  bg,
  accent,
  width = 1024,
}: {
  fg: string;
  bg: string | null;
  accent: string;
  width?: number;
}): string {
  const height = Math.round(width * 0.25);
  const plate = bg ? `<rect width="256" height="64" fill="${bg}"/>` : "";
  const strokes = PATHS.map((d) => `<path d="${d}"/>`).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 64" width="${width}" height="${height}">`,
    plate,
    `<g transform="translate(16 16) scale(1)">`,
    `<g fill="none" stroke="${accent}" stroke-width="2.1" stroke-linecap="round">${strokes}</g>`,
    `</g>`,
    `<text x="60" y="41" font-family="Space Grotesk, Inter, Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="-0.6" fill="${fg}">vibe<tspan fill="${accent}">bundl</tspan></text>`,
    `</svg>`,
  ].join("");
}

/** Ready to paste into an <img src> or an <a href download>. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The palette the kit ships. Everything here is a token from globals.css. */
export const BRAND = {
  ink: "#08090a",
  paper: "#fafafa",
  ember: "#fb923c",
  emberDark: "#c2410c",
  ringOnDark: "rgba(250,250,250,0.4)",
  ringOnLight: "rgba(9,9,16,0.14)",
} as const;
