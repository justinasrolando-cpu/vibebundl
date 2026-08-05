/**
 * The VibeBundl mark: three stacked bars held inside a bracket — many
 * things collapsed into one held object. A bracket rather than the
 * reference site's [?!] enclosure, so it reads as a sibling, not a copy.
 *
 * `currentColor` on the bars means the mark follows the user's accent
 * choice for free; the bracket stays at the accent token so the shape
 * still reads when the mark sits on a coloured surface.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="VibeBundl"
      fill="none"
    >
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <path d="M10 8.5H8.6A1.6 1.6 0 0 0 7 10.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10" />
        <path d="M22 8.5h1.4A1.6 1.6 0 0 1 25 10.1v11.8a1.6 1.6 0 0 1-1.6 1.6H22" />
        <path d="M13 11.8h5" />
        <path d="M13 16h6" />
        <path d="M13 20.2h4" />
      </g>
    </svg>
  );
}

/** Mark + wordmark, for headers and the auth screen. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="size-[1.6em] shrink-0 text-accent" />
      <span className="font-semibold tracking-tight">
        vibe<span className="text-accent">bundl</span>
      </span>
    </span>
  );
}
