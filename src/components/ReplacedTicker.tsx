import { TOOLS, TOTAL_ORIGINAL_PRICE } from "@/lib/tools";

/**
 * The bill, scrolling past.
 *
 * Every name and every figure here is read straight out of the catalogue —
 * `replaces` and `originalPrice` on each tool — so the ticker cannot drift
 * from what we actually ship, and the total at the end is the sum of the
 * numbers you just watched go by. Nothing is padded to make the band look
 * fuller.
 *
 * Mechanics: the track holds the list twice and translates by exactly -50%,
 * so the second copy is under the cursor at the instant the first finishes
 * and the loop has no seam. `aria-hidden` on the duplicate keeps a screen
 * reader from hearing 106 line items; the visible copy carries the content.
 *
 * The band is sorted most-expensive-first, because the argument is strongest
 * at the front: the first thing you read is the biggest number you're paying.
 */
const ITEMS = [...TOOLS]
  .sort((a, b) => b.originalPrice - a.originalPrice)
  .map((t) => ({ key: t.slug, name: t.replaces, price: t.originalPrice }));

function priceLabel(n: number) {
  // Whole dollars stay whole; 14.99 keeps its cents. Trailing ".00" on a
  // price band reads as a spreadsheet, not a receipt.
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function Run({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden || undefined}>
      {ITEMS.map((item) => (
        <span key={item.key} className="flex items-center whitespace-nowrap">
          <span className="text-muted">{item.name}</span>
          <span className="tnum ml-2 text-muted-2">−{priceLabel(item.price)}/mo</span>
          <span className="mx-4 text-muted-2/50" aria-hidden>
            ·
          </span>
        </span>
      ))}
    </div>
  );
}

export default function ReplacedTicker({ className = "" }: { className?: string }) {
  const total = Math.round(TOTAL_ORIGINAL_PRICE);

  return (
    <section
      className={`relative border-y border-border bg-background-elevated py-3 ${className}`}
      aria-label="Subscriptions this bundle replaces"
    >
      {/* Faded ends, so the band reads as continuous rather than as a row
          that got cut off by the viewport. */}
      <div className="marquee">
        <div className="marquee-track text-xs">
          <Run />
          <Run ariaHidden />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-2">
        <span className="tnum text-foreground">${total}/mo</span> of SaaS bills, on the
        block.
      </p>
    </section>
  );
}
