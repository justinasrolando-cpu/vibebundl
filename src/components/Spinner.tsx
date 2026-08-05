/**
 * Inline loading indicator, sized to sit inside a .btn next to its label.
 * Spins fast on purpose — a quick spinner makes the same wait feel shorter.
 */
export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 [animation-duration:0.6s] ${className}`}
    />
  );
}
