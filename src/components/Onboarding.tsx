"use client";

import ToolIcon from "@/components/ToolIcon";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TOOLS, groupToolsByCategory } from "@/lib/tools";

/**
 * First-run welcome for a subscribed user landing on the dashboard.
 *
 * Self-contained: reads and writes its own dismissal flag, renders nothing
 * once dismissed, and needs no props. Drop it anywhere inside the dashboard
 * (which is already behind the subscription gate).
 */

export const ONBOARDING_KEY = "bundle_onboarding_dismissed";

const CATEGORY_COUNT = groupToolsByCategory().length;

/** Hand-picked first stops. Copy lives here; names/icons stay derived from TOOLS. */
const STARTER_HINTS: { slug: string; blurb: string }[] = [
  { slug: "links", blurb: "Put every link you own on one page you can share today." },
  { slug: "notes", blurb: "Somewhere to think. Markdown, tags, instant search." },
  { slug: "tasks", blurb: "Move this week out of your head and into due dates." },
  { slug: "writer", blurb: "Headlines, emails, ad copy — from a prompt and a template." },
];

const STARTERS = STARTER_HINTS.flatMap((hint) => {
  const tool = TOOLS.find((t) => t.slug === hint.slug);
  return tool ? [{ ...tool, blurb: hint.blurb }] : [];
});

/* localStorage is not a reactive store, but useSyncExternalStore is still the
   cleanest way to read it without a hydration mismatch: the server snapshot
   says "dismissed", so nothing flashes in before the client confirms. */
function subscribeNoop() {
  return () => {};
}

function getDismissedSnapshot() {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot() {
  return true;
}

export default function Onboarding() {
  const storedDismissed = useSyncExternalStore(
    subscribeNoop,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function dismiss() {
    if (leaving) return;
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* private mode — it just reappears next visit, which is survivable */
    }
    setLeaving(true);
    timer.current = setTimeout(() => setGone(true), 260);
  }

  if (storedDismissed || gone) return null;

  return (
    // Grid-rows 1fr → 0fr collapses the space it occupied instead of leaving a
    // hole, so the tool grid rises to meet the dismiss.
    <div
      className="grid transition-[grid-template-rows,opacity] duration-[260ms] ease-[var(--ease-out)]"
      style={{ gridTemplateRows: leaving ? "0fr" : "1fr", opacity: leaving ? 0 : 1 }}
    >
      <div className="overflow-hidden">
        <section
          aria-label="Getting started"
          className="card-raised animate-fade-in relative isolate mt-6 overflow-hidden p-5 sm:p-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-64 bg-[radial-gradient(32rem_14rem_at_18%_100%,rgba(74,222,128,0.10),transparent_70%)]"
          />

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Welcome in</p>
              <h2 className="title-2 mt-1.5">
                All {TOOLS.length} tools are unlocked{" "}
                <span className="text-muted-2">— nothing else to set up.</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                One login covers every tool across {CATEGORY_COUNT} categories, and your work in
                each one stays private to your account. Pick a starting point below, or press{" "}
                <kbd className="chip font-mono text-[0.625rem]">/</kbd> to search all of them by
                name — or by the subscription they replace.
              </p>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss the welcome message"
              className="btn btn-ghost -mt-1.5 -mr-1.5 shrink-0 px-2 py-1 text-xs"
            >
              ✕
            </button>
          </div>

          <p className="eyebrow mt-6">Start here</p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {STARTERS.map((tool, i) => (
              <Link
                key={tool.slug}
                href={`/dashboard/${tool.slug}`}
                onClick={dismiss}
                style={{ animationDelay: `${60 + i * 45}ms` }}
                className="card card-interactive animate-fade-in group flex flex-col gap-2 bg-surface-2 p-3.5"
              >
                <span className="flex items-center gap-2.5">
                  <span className="icon-tile" aria-hidden>
                    <ToolIcon slug={tool.slug} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium tracking-tight">
                    {tool.name}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-xs text-muted-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    →
                  </span>
                </span>
                <span className="text-xs leading-relaxed text-muted">{tool.blurb}</span>
                <span className="mt-auto pt-1 text-[0.6875rem] text-muted-2">
                  replaces {tool.replaces}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
            <p className="flex-1 text-xs text-muted-2">
              Everything in the sidebar is already yours — this note won&apos;t come back.
            </p>
            <button type="button" onClick={dismiss} className="btn btn-secondary text-xs">
              Got it
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
