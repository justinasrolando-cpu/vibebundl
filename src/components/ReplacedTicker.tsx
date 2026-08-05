import { TOOLS, TOTAL_ORIGINAL_PRICE } from "@/lib/tools";

/**
 * The bill, scrolling past, with the total set as an odometer.
 *
 * Every name and every figure is read straight out of the catalogue —
 * `replaces` and `originalPrice` on each tool — so the band cannot drift
 * from what we actually ship, and the total underneath is the sum of the
 * numbers you just watched go by. Nothing is padded to make it look fuller.
 *
 * Mechanics of the loop: the track holds the list twice and translates by
 * exactly -50%, so the second copy is under the cursor at the instant the
 * first finishes and the wrap has no seam. `aria-hidden` on the duplicate
 * keeps a screen reader from hearing 106 line items.
 *
 * Sorted most-expensive-first, because the argument is strongest at the
 * front: the first thing you read is the biggest number you're paying.
 */
const ITEMS = [...TOOLS]
  .sort((a, b) => b.originalPrice - a.originalPrice)
  .map((t) => ({ key: t.slug, name: t.replaces, price: t.originalPrice }));

function priceLabel(n: number) {
  // Whole dollars stay whole; 14.99 keeps its cents. Trailing ".00" across a
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

/**
 * One digit in its own recessed tile.
 *
 * Splitting the total into per-character tiles is what turns a number into
 * a *counter* — the same read as a departure board or a meter, which is the
 * right metaphor for a running bill. Every tile is the same width whatever
 * digit it holds (tabular figures plus a fixed box), so the total doesn't
 * jitter if the catalogue grows a digit.
 *
 * The separators — the "$", the comma — deliberately do NOT get a tile.
 * Boxing punctuation makes the group read as six unrelated characters
 * instead of one number.
 */
function Odometer({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {value.split("").map((char, i) =>
        /\d/.test(char) ? (
          <span
            key={i}
            className="tnum flex h-9 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-lg font-semibold tracking-tight text-foreground shadow-[var(--highlight)]"
          >
            {char}
          </span>
        ) : (
          <span key={i} className="px-0.5 text-lg font-semibold text-muted">
            {char}
          </span>
        ),
      )}
    </span>
  );
}

export default function ReplacedTicker({ className = "" }: { className?: string }) {
  const total = Math.round(TOTAL_ORIGINAL_PRICE).toLocaleString("en-US");

  return (
    <section
      className={`relative border-y border-border bg-background-elevated py-4 ${className}`}
      aria-label="Subscriptions this bundle replaces"
    >
      {/* Faded ends, so the band reads as continuous rather than as a row the
          viewport happened to cut off. */}
      <div className="marquee">
        <div className="marquee-track text-xs">
          <Run />
          <Run ariaHidden />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4">
        <span className="text-right text-xs leading-tight text-muted-2">
          SaaS bills
          <br />
          on the block
        </span>
        {/* The screen-reader version says it once, in words, rather than
            spelling out eight boxed characters. */}
        <span className="sr-only">${total} per month of SaaS bills on the block.</span>
        <Odometer value={`$${total}`} />
        <span className="text-sm text-muted-2">/mo</span>
      </div>
    </section>
  );
}
