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
import { BUNDLE_PRICE_USD, TOOLS, TOTAL_ORIGINAL_PRICE } from "@/lib/tools";

/**
 * The price band.
 *
 * ── What changed, and why it matters ────────────────────────────────────────
 * This used to headline "$840/mo — what one customer stops paying the month
 * they switch". Every digit of that was arithmetic on the price list, and the
 * sentence was still false.
 *
 * Nobody was paying $860 a month. Nobody buys all 53 of these products. The
 * subtraction is real and the claim built on it is not, which is the most
 * dangerous kind of number to put at hero scale: technically defensible, and
 * indefensible the moment somebody who actually pays for one of them checks.
 * That is exactly what happened — the first outside reader picked the one
 * tool he already subscribed to, found ours thinner, and generalised.
 *
 * So the headline is now the LIST PRICE, and the copy says outright that you
 * were never paying it. That is a true sentence, and it turns out to be the
 * better pitch: the offer isn't "cancel $860 of software", it's "don't sign
 * up for the next one".
 *
 * ── The rule that did not change ────────────────────────────────────────────
 * The number is real or it isn't shown. No seed, no baseline, no padding, no
 * rounding to something friendlier. $860.39 is the sum of published prices in
 * src/lib/tools.ts, so it's known on the server, true before anyone signs up,
 * and cannot drift from the catalogue.
 *
 * ── Why the count-up is not a fabrication ───────────────────────────────────
 * It animates from 0 to the true value once, on first view. Nobody reads a
 * transient 0 as a claim — it's the visual equivalent of the digits landing.
 * The *markup* renders at the true value; the count-up only starts once a
 * layout effect confirms we're on a client that can run it, so the server, a
 * crawler and a reduced-motion visitor all get the real figure with no
 * animation in front of it.
 */

/** The gap between the list price and ours. Shown as arithmetic in the
    receipt, never as a claim about money anyone actually had. */
const LIST_MINUS_BUNDLE = TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD;

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

  /* The headline is the LIST PRICE of the 53, not a saving.
     See the note at the top of this file for why that changed. */
  const { shown, start } = useCountUp(TOTAL_ORIGINAL_PRICE);
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
            <p className="eyebrow">Bought separately</p>

            <p className="tnum mt-3 font-sans font-bold text-[clamp(3.25rem,11vw,6rem)] leading-[0.9] tracking-[-0.035em]">
              {/* A screen reader gets the settled figure, once, in words it can
                  say — never a partial count mid-animation. */}
              <span className="sr-only">{money(TOTAL_ORIGINAL_PRICE)} per month</span>
              <span className="text-gradient" aria-hidden>
                {money(shown)}
              </span>
              <span
                className="align-baseline text-[0.26em] font-normal tracking-normal text-muted-2"
                aria-hidden
              >
                /mo
              </span>
            </p>

            <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
              is the list price of all {TOOLS.length} bought one at a time.{" "}
              <span className="text-foreground">You were never paying that</span> — nobody
              buys all {TOOLS.length}. The point is the next one you&apos;d sign up for.
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
              <Line label="Difference" value={`$${LIST_MINUS_BUNDLE.toFixed(2)}`} accent />
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
            Summed from the public price of each product these replace the core of. We
            don&apos;t claim you were paying it, and we don&apos;t call the difference a
            saving — if you actually depend on one of them, keep paying for it. What
            ${BUNDLE_PRICE_USD} buys is not having to sign up for the next one.
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
