"use client";

import ToolIcon from "@/components/ToolIcon";
import { useState } from "react";
import Spinner from "./Spinner";
import { BUNDLE_PRICE_USD, TOTAL_ORIGINAL_PRICE, TOOLS, groupToolsByCategory, TOOL_COUNT_LABEL } from "@/lib/tools";

const GROUPS = groupToolsByCategory();
const TOTAL_ROUNDED = Math.round(TOTAL_ORIGINAL_PRICE);
const SAVINGS = Math.round(TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD);
const MULTIPLE = Math.round(TOTAL_ORIGINAL_PRICE / BUNDLE_PRICE_USD);

const INCLUDED = [
  `All ${TOOL_COUNT_LABEL} tools unlock at once — no per-tool upgrades`,
  "One login, one bill, unlimited use",
  "Everything you make stays private to your account",
  "Cancel any time — the bundle stays open until the period ends",
];

export default function SubscribeGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (res.ok && data?.url) {
        window.location.href = data.url;
        return; // Leave `loading` on — the page is on its way out.
      }

      setError(
        res.status === 401
          ? "Your session expired. Refresh the page, sign in again, and we'll pick up here."
          : data?.error
            ? `Checkout wouldn't start: ${data.error}`
            : "We couldn't start checkout just now. Try again in a moment — you haven't been charged.",
      );
    } catch {
      setError("Couldn't reach checkout. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden px-5 py-10 md:py-14">
      <div className="aura" aria-hidden />

      <div className="animate-fade-in mx-auto w-full max-w-5xl">
        <header className="max-w-2xl">
          <p className="font-mono text-xs text-accent">
            <span className="text-muted-2">$</span> unlock --all
            <span className="caret" aria-hidden>
              ▍
            </span>
          </p>
          <h1 className="title-1 mt-4">
            One subscription.{" "}
            <span className="whitespace-nowrap">All {TOOL_COUNT_LABEL} tools.</span>
          </h1>
          {/* Reads for both arrivals: a new account that closed the Stripe tab,
              and a lapsed subscriber whose card stopped working. Neither of
              them needs to be told they're signed in — they can see that. */}
          <p className="lede mt-3">
            Your account is ready; the subscription isn&apos;t started yet. Every tool in the
            sidebar opens the moment it is. Bought one at a time, the apps they replace run
            about {MULTIPLE}× the price.
          </p>
        </header>

        <div className="mt-9 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* ---------- What you get ---------- */}
          <div className="order-2 flex flex-col gap-5 lg:order-1">
            <section className="card p-5">
              <h2 className="eyebrow">What ${BUNDLE_PRICE_USD} a month covers</h2>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {INCLUDED.map((line, i) => (
                  <li
                    key={line}
                    style={{ animationDelay: `${60 + i * 45}ms` }}
                    className="animate-fade-in flex items-start gap-2.5 text-sm leading-relaxed text-muted"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[0.5625rem] text-accent"
                    >
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="flex items-center gap-3">
                <h2 className="eyebrow">
                  Inside the bundle · {GROUPS.length} categories
                </h2>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {GROUPS.map((group, i) => {
                  const named = group.tools.slice(0, 3);
                  const rest = group.tools.length - named.length;
                  return (
                    <div
                      key={group.category}
                      style={{ animationDelay: `${80 + i * 40}ms` }}
                      className="card animate-fade-in flex flex-col gap-2.5 p-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold tracking-tight">
                          {group.category}
                        </h3>
                        <span className="chip tnum font-mono">{group.tools.length}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {group.tools.slice(0, 6).map((tool) => (
                          <span
                            key={tool.slug}
                            title={tool.name}
                            aria-hidden
                            className="icon-tile size-7 text-[0.8125rem]"
                          >
                            <ToolIcon slug={tool.slug} />
                          </span>
                        ))}
                      </div>

                      <p className="text-xs leading-relaxed text-muted-2">
                        {named.map((t) => t.name).join(", ")}
                        {rest > 0 ? ` and ${rest} more` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ---------- Price + CTA ---------- */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-6">
            <div className="card-raised p-6">
              <p className="eyebrow">The whole bundle</p>

              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="tnum text-gradient text-5xl font-semibold tracking-tight">
                  ${BUNDLE_PRICE_USD}
                </span>
                <span className="text-sm text-muted-2">/month</span>
              </p>

              <div className="mt-5 border-t border-dashed border-border pt-4 font-mono text-sm">
                <div className="flex items-center gap-3 py-1">
                  <span className="text-muted">Bought separately</span>
                  <span className="min-w-4 flex-1 border-b border-dashed border-border" />
                  <span className="tnum text-muted-2 line-through">${TOTAL_ROUNDED}/mo</span>
                </div>
                <div className="flex items-center gap-3 py-1">
                  <span className="text-foreground">Bundled here</span>
                  <span className="min-w-4 flex-1 border-b border-dashed border-border" />
                  <span className="tnum text-accent">${BUNDLE_PRICE_USD}/mo</span>
                </div>
              </div>

              <p className="chip chip-accent tnum mt-4">You keep ${SAVINGS}/mo</p>

              <button
                onClick={subscribe}
                disabled={loading}
                className="btn btn-primary btn-lg mt-5 w-full disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Opening checkout…" : `Subscribe — $${BUNDLE_PRICE_USD}/mo`}
              </button>

              {error && (
                <p
                  role="alert"
                  className="animate-fade-in mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger"
                >
                  {error}
                </p>
              )}

              <p className="mt-3 text-center text-xs leading-relaxed text-muted-2">
                Secure checkout via Stripe · cancel any time
              </p>
            </div>

            <p className="mt-3 px-1 text-xs leading-relaxed text-muted-2">
              Prices compared are the paid tiers of the apps each tool replaces, as listed on the
              home page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
