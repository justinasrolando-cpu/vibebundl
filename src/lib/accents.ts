/**
 * Accent constants and pure helpers.
 *
 * These live OUTSIDE the "use client" component on purpose: the dashboard
 * layout is a server component and needs `normalizeAccent()` to server-render
 * `data-accent` (which is what prevents a flash of the default accent before
 * the user's saved preference loads). Importing a plain function from a
 * "use client" module and calling it on the server throws at request time —
 * it builds clean and 500s in production, which is exactly what happened.
 */

export const ACCENTS = [
  { value: "mono", label: "Paper", note: "Default" },
  { value: "green", label: "Green", note: "" },
  { value: "cyan", label: "Cyan", note: "" },
  { value: "blue", label: "Blue", note: "" },
  { value: "violet", label: "Violet", note: "" },
  { value: "fuchsia", label: "Fuchsia", note: "" },
  { value: "amber", label: "Amber", note: "" },
] as const;

export type AccentValue = (typeof ACCENTS)[number]["value"];

/** Paper is the brand. Anything unrecognised or missing falls back to it. */
export const DEFAULT_ACCENT: AccentValue = "mono";

export function isAccent(value: unknown): value is AccentValue {
  return ACCENTS.some((a) => a.value === value);
}

export function normalizeAccent(value: unknown): AccentValue {
  return isAccent(value) ? value : DEFAULT_ACCENT;
}
