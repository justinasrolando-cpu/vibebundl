import type { ReactNode } from "react";

/**
 * Chrome glyphs for pins and settings.
 *
 * Same pen as ToolIcon: 24×24 box, 1.5 stroke, round caps and joins,
 * geometry over illustration. Kept in its own file so the tool icon set
 * stays exactly that — one icon per tool — while the interface around it
 * still gets drawn shapes rather than platform-dependent glyphs.
 *
 * `pin` and `pin-filled` are the same silhouette. The filled state adds
 * `fill="currentColor"` at the call site rather than a second path, so the
 * two never drift apart and the transition between them is a colour
 * change, not a shape swap.
 */

const PATHS: Record<string, ReactNode> = {
  // Pin — a push-pin seen head-on, needle down.
  pin: (
    <>
      <path d="M9 3.5h6l-.75 5.25 2.75 2.5v1.5H7v-1.5l2.75-2.5z" />
      <path d="M12 12.75V20.5" />
    </>
  ),

  // Settings — a slider bank. Reads as "preferences", not "system".
  settings: (
    <>
      <path d="M4 7.5h9" />
      <path d="M17 7.5h3" />
      <circle cx="15" cy="7.5" r="2" />
      <path d="M4 16.5h3" />
      <path d="M11 16.5h9" />
      <circle cx="9" cy="16.5" r="2" />
    </>
  ),

  // Check — confirmation.
  check: <path d="M5 12.5l4.5 4.5L19 7" />,

  // Card — billing.
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.75h19" />
      <path d="M6.5 14.5h3.5" />
    </>
  ),

  // Power — sign out.
  power: (
    <>
      <path d="M12 3.5v8" />
      <path d="M17.5 6.75a7 7 0 1 1-11 0" />
    </>
  ),

  // External — this link leaves the app.
  external: (
    <>
      <path d="M13.5 4.5h6v6" />
      <path d="M19.5 4.5L11 13" />
      <path d="M18.5 14v4a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V8A2.5 2.5 0 0 1 6 5.5h4" />
    </>
  ),
};

export type GlyphName = keyof typeof PATHS;

export default function Glyph({
  name,
  size = 16,
  filled = false,
  className,
}: {
  name: GlyphName;
  size?: number;
  /** Fills the shape with currentColor — used for the pinned state. */
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
