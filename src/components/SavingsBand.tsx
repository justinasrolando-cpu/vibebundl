"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePublicStats } from "@/components/usePublicStats";
import { BUNDLE_PRICE_USD, TOOLS, TOTAL_ORIGINAL_PRICE, TOOL_COUNT_LABEL } from "@/lib/tools";

/**
 * The savings band — now the first thing under the headline, at hero scale.
 *
 * ── The one rule this component exists to keep ──────────────────────────────
 * The number is real or it isn't shown. No seed, no baseline, no "starting
 * from" figure, no padding, no rounding up to something friendlier. There are
 * exactly two figures it will ever headline, and both are arithmetic on
 * something we can point at:
 *
 *   1. `catalogue price − bundle price` — what one customer stops paying per
 *      month. Sourced entirely from src/lib/tools.ts, so it is known on the
 *      server, true before anyone has signed up, and never changes between
 *      the first paint and the RPC landing.
 *   2. `subscription-months × (catalogue price − bundle price)` — the total
 *      customers have actually kept. The months come from the database. It is
 *      only ever headlined once it is a real, non-zero number.
 *
 * Until (2) exists the band leads with (1). That isn't a placeholder for a
 * number we wish we had — it's a different, smaller, entirely true claim, and
 * at $840/mo it is a better one to lead with anyway. A "$0 saved" tombstone
 * would be equally honest and actively worse: it invites the reader to infer
 * failure from a number that only means "new".
 *
 * ── Why the band no longer waits for the RPC ────────────────────────────────
 * It used to render nothing until `public_stats()` answered, which was right
 * when it sat halfway down the page and wrong now that it's the hero moment:
 * a 300ms hole above the fold that then shoves the page down. Figure (1) needs
 * no database, so it paints with the document. The *live counts* still wait —
 * they're the only thing here the database owns, and a count we can't source
 * is worse than no count. Their row keeps its height reserved so nothing
 * shifts when they land.
 *
 * ── Why the count-up is not a fabrication ───────────────────────────────────
 * It animates from 0 to the true value once, on first view. Nobody reads a
 * transient 0 as a claim — it's the visual equivalent of the digits landing.
 * Crucially the *markup* is rendered at the true value; the count-up only
 * starts once a layout effect has confirmed we're on a client that can run it,
 * so the server, a crawler, and a reduced-motion visitor all get the real
 * figure with no animation in front of it.
 */

/** What one customer stops paying, per month. A fact about the price list. */
const PER_CUSTOMER_MONTHLY = TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Live, so flipping the OS setting mid-visit is honoured without a reload. */
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Layout effects don't run on the server; asking for one there only warns. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Counts to `target` once `start()` is called. Cubic ease-out over 900ms —
 * longer than a UI animation is allowed to be, which is correct here: this is
 * explanatory marketing motion seen once per visit, not a control being
 * pressed.
 *
 * Two properties earn their complexity:
 *
 * • Before `start()`, it reports `target`. That's what makes the band safe to
 *   server-render: the HTML says $840, hydration agrees, and the run to 0 only
 *   happens after a layout effect has fired — before the first client paint,
 *   so there's no flash of the settled number.
 * • Each run departs from wherever the digits currently are, not from 0. The
 *   only time the target ever changes is when the RPC reports a real lifetime
 *   total, and that should read as the figure *growing* into the bigger true
 *   number rather than collapsing to zero and re-counting.
 */
function useCountUp(target: number, duration = 900) {
  const [running, setRunning] = useState(false);
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!running) return;

    const origin = from.current;
    const startedAt = performance.now();
    let frame = 0;

    const settle = () => {
      cancelAnimationFrame(frame);
      from.current = target;
      setValue(target);
    };

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const next = origin + (target - origin) * (1 - Math.pow(1 - t, 3));
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else settle();
    };

    frame = requestAnimationFrame(tick);

    // Animation frames stop in a backgrounded tab. If the visit turns into one
    // mid-count, the digits would freeze partway and stay there — understating
    // a true figure, which is the one failure this component may not have. A
    // wall-clock backstop lands the real number regardless of whether a single
    // frame ever ran.
    const backstop = window.setTimeout(settle, duration + 400);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(backstop);
    };
  }, [running, target, duration]);

  return { shown: running ? value : target, start: useCallback(() => setRunning(true), []) };
}

/**
 * Runs `onSeen` the first time the node is genuinely being looked at.
 *
 * Two things make this more than a one-line IntersectionObserver:
 *
 * • The synchronous rect check. Sitting under the headline, the band is often
 *   already in view at load, and an observer only reports *after* the first
 *   paint — so the reader would catch one frame of the settled figure before
 *   it dropped to 0 and counted back. Measuring inside a layout effect starts
 *   the count before anything is painted.
 * • The visibility gate. A backgrounded tab runs no animation frames, so a
 *   count started against a hidden document would sit at 0 until the tab was
 *   focused. "In the viewport" of a tab nobody is looking at is not a view;
 *   we wait for the real one.
 */
function useOnFirstView(onSeen: () => void, enabled: boolean) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!node || !enabled) return;

    let observer: IntersectionObserver | undefined;
    let done = false;

    const cleanup = () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", attempt);
    };

    const fire = () => {
      if (done) return;
      done = true;
      cleanup();
      onSeen();
    };

    function attempt() {
      if (done || document.hidden) return;

      const rect = node!.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        fire();
        return;
      }

      // No observer to wait on means no way to know when it scrolls into view.
      // Deliver the number rather than gamble it on an animation that may
      // never be triggered.
      if (typeof IntersectionObserver === "undefined") {
        fire();
        return;
      }

      if (observer) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!document.hidden && entries.some((entry) => entry.isIntersecting)) fire();
        },
        { rootMargin: "-40px" },
      );
      observer.observe(node!);
    }

    document.addEventListener("visibilitychange", attempt);
    attempt();

    return cleanup;
  }, [node, enabled, onSeen]);

  return setNode;
}

export default function SavingsBand() {
  const { status, stats } = usePublicStats();
  const reducedMotion = useReducedMotion();

  const ready = status === "ready" && stats !== null;
  const totalSaved = (stats?.subscriptionMonths ?? 0) * PER_CUSTOMER_MONTHLY;

  /**
   * Lead with the lifetime total only when there is a lifetime total to lead
   * with. Rounding to $0 is the same tombstone as having no subscribers at
   * all, whatever the subscriber count says — so the test is on the figure,
   * not on the customer count. Nothing is inflated to clear the bar; the band
   * just declines to headline a number that hasn't happened yet.
   */
  const hasTotal = ready && (stats?.activeSubscribers ?? 0) > 0 && Math.round(totalSaved) > 0;
  const headline = hasTotal ? totalSaved : PER_CUSTOMER_MONTHLY;

  const { shown, start } = useCountUp(headline);
  const setNode = useOnFirstView(start, !reducedMotion);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-[var(--section-gap)]">
      <div
        ref={setNode}
        className="card card-raised relative isolate overflow-hidden px-6 py-8 sm:px-9 sm:py-10"
      >
        <div className="aura opacity-70" aria-hidden />

        <div className="flex flex-col gap-9 lg:flex-row lg:items-end lg:justify-between">
          {/* The moment. Everything else on this card is evidence for it. */}
          <div className="min-w-0">
            <p className="eyebrow">{hasTotal ? "Saved so far" : "What it saves"}</p>

            <p className="tnum mt-3 font-sans font-bold text-[clamp(3.25rem,11vw,6rem)] leading-[0.9] tracking-[-0.035em]">
              {/* A screen reader gets the settled figure, once, in words it can
                  say — never a partial count mid-animation. */}
              <span className="sr-only">
                {money(headline)}
                {hasTotal ? "" : " per month"}
              </span>
              <span className="text-gradient" aria-hidden>
                {money(shown)}
              </span>
              {hasTotal ? null : (
                <span
                  className="align-baseline text-[0.26em] font-normal tracking-normal text-muted-2"
                  aria-hidden
                >
                  /mo
                </span>
              )}
            </p>

            <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
              {hasTotal ? (
                <>
                  in subscriptions VibeBundl customers aren&apos;t paying for any more.{" "}
                  <span className="text-foreground">And counting.</span>
                </>
              ) : (
                <>
                  is what one customer stops paying{" "}
                  <span className="text-foreground">the month they switch.</span>
                </>
              )}
            </p>
          </div>

          {/* The arithmetic, in full, beside the figure it produces — the proof
              belongs on the same screen as the claim, not in a footnote you
              have to scroll to. Every value here comes from src/lib/tools.ts. */}
          <div className="w-full shrink-0 font-mono text-sm lg:w-[19rem]">
            <Line
              label={`${TOOLS.length} subscriptions`}
              value={`$${TOTAL_ORIGINAL_PRICE.toFixed(2)}`}
            />
            <Line label="VibeBundl" value={`−$${BUNDLE_PRICE_USD.toFixed(2)}`} />
            <div className="mt-2 border-t border-dashed border-border-strong pt-2">
              <Line label="You keep, monthly" value={`$${PER_CUSTOMER_MONTHLY.toFixed(2)}`} accent />
            </div>
          </div>
        </div>

        {/* The two counts the database owns. Their *labels* are copy and paint
            with the document; only the values wait on the RPC, so the row is
            the same height before and after it answers and nothing below the
            band moves. An empty value slot is honest about not knowing yet —
            a shimmering placeholder would be pretending to. */}
        {/* Side by side only at lg. At sm the note takes its full max-w-md and
            leaves the three counts about 180px to share, which wraps them onto
            two lines inside a row that is meant to read as one. */}
        <div className="mt-8 flex flex-col gap-5 border-t border-border pt-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Sized to their content with a real gap between them, not three
              equal fractions of a narrow column. Equal fractions is what this
              was, and an eyebrow is uppercase with 0.09em tracking — at tablet
              width "Requests" was wider than its third and ran straight into
              the next label. The labels are also short now: "Shipped from
              requests" wrapped to two lines at almost every width and pushed
              its own digit off the baseline the other two sat on. */}
          <dl className="flex flex-1 flex-wrap gap-x-9 gap-y-4">
            <Stat label="Tools" value={TOOLS.length.toLocaleString("en-US")} />
            <Stat
              label="Requests"
              value={ready ? stats!.toolRequests.toLocaleString("en-US") : null}
            />
            <Stat
              label="Shipped"
              value={ready ? stats!.toolsShippedFromRequests.toLocaleString("en-US") : null}
            />
          </dl>

          <p className="max-w-md text-xs leading-relaxed text-muted-2 lg:text-right">
            {hasTotal ? (
              <>
                Every active subscription-month multiplied by the{" "}
                <span className="tnum text-muted">{money(PER_CUSTOMER_MONTHLY)}/mo</span> difference
                between the {TOOL_COUNT_LABEL} list prices and ours. Read live from the database on
                every page load — no baseline, no padding.
              </>
            ) : (
              <>
                We launched recently, so there is no lifetime savings total worth showing yet — and
                we&apos;re not going to invent one. The figure above is arithmetic on the price
                list, not a claim about how many people have signed up.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Same leader-dot receipt row as the pricing panel further down the page. */
function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={accent ? "text-foreground" : "text-muted"}>{label}</span>
      <span className="min-w-4 flex-1 border-b border-dashed border-border" aria-hidden />
      <span className={`tnum shrink-0 ${accent ? "text-accent" : "text-muted-2"}`}>{value}</span>
    </div>
  );
}

/** `min-h-7` is one line of the value's own type, so the empty state and the
    settled state occupy exactly the same box and nothing shifts when the RPC
    lands. `whitespace-nowrap` on the label keeps a stat from becoming two
    lines tall and dragging its own digit off the shared baseline — these are
    one-word labels, so there is nothing worth wrapping. */
function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="eyebrow whitespace-nowrap">{label}</dt>
      <dd className="tnum mt-1 min-h-7 text-lg font-semibold tracking-tight">
        {value === null ? null : <span className="animate-fade-in inline-block">{value}</span>}
      </dd>
    </div>
  );
}
