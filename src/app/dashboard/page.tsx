"use client";

import ToolIcon from "@/components/ToolIcon";
import ToolCard from "@/components/ToolCard";
import Glyph from "@/components/Glyph";
import { usePinnedTools } from "@/components/usePinnedTools";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { TOOLS, TOOLS_BY_SLUG, categoryKey, groupToolsByCategory, type Tool } from "@/lib/tools";

const CATEGORY_COUNT = groupToolsByCategory().length;

const ONBOARDING_KEY = "bundle_onboarding_dismissed";
const RECENTS_KEY = "bundle_recent_tools";
const MAX_RECENTS = 5;

/** How many recents survive once pins exist. See the note at the section. */
const MAX_RECENTS_ALONGSIDE_PINS = 3;

function subscribeNoop() {
  return () => {};
}

function getDismissedSnapshot() {
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

function getDismissedServerSnapshot() {
  return true;
}

/** Raw string snapshot — stable identity, so useSyncExternalStore stays happy. */
function getRecentsSnapshot() {
  try {
    return window.localStorage.getItem(RECENTS_KEY) ?? "";
  } catch {
    return "";
  }
}

function getRecentsServerSnapshot() {
  return "";
}

function parseRecents(raw: string): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function WelcomeCard() {
  const storedDismissed = useSyncExternalStore(
    subscribeNoop,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );
  const [closed, setClosed] = useState(false);
  if (storedDismissed || closed) return null;

  return (
    <div className="card animate-fade-in mt-6 flex items-start gap-4 p-4 pl-5">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      <p className="flex-1 text-sm leading-relaxed text-muted">
        <span className="font-medium text-foreground">Everything below is already unlocked.</span>{" "}
        Start with whatever replaces the subscription you resent paying for this month.{" "}
        <span className="text-muted-2">Pin the ones you keep coming back to.</span>
      </p>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(ONBOARDING_KEY, "1");
          setClosed(true);
        }}
        aria-label="Dismiss welcome message"
        className="btn btn-ghost -mt-1 -mr-1 shrink-0 px-2 py-1 text-xs"
      >
        ✕
      </button>
    </div>
  );
}

export default function DashboardHome() {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { pins, isPinned, busy, toggle, error: pinError, dismissError } = usePinnedTools();

  const rawRecents = useSyncExternalStore(
    subscribeNoop,
    getRecentsSnapshot,
    getRecentsServerSnapshot,
  );

  // "/" focuses search — the fastest path through 53 tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const remember = useCallback((slug: string) => {
    try {
      const current = parseRecents(getRecentsSnapshot());
      const next = [slug, ...current.filter((s) => s !== slug)].slice(0, MAX_RECENTS);
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — recents are a nicety, never a dependency */
    }
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? TOOLS.filter(
          (tool) =>
            tool.name.toLowerCase().includes(q) ||
            tool.replaces.toLowerCase().includes(q) ||
            tool.description.toLowerCase().includes(q) ||
            tool.category.toLowerCase().includes(q),
        )
      : TOOLS;
    return groupToolsByCategory(filtered);
  }, [query]);

  const totalMatches = groups.reduce((sum, g) => sum + g.tools.length, 0);
  const searching = query.trim().length > 0;

  const pinnedTools = useMemo(
    () =>
      (pins ?? [])
        .map((slug) => TOOLS_BY_SLUG.get(slug))
        .filter((t): t is Tool => Boolean(t)),
    [pins],
  );

  /**
   * Pins and recents answer two different questions — "what do I use?" and
   * "what was I just doing?" — but they overwhelmingly return the same tools,
   * because you pin what you keep opening. Two near-identical rows stacked at
   * the top is the redundancy to avoid.
   *
   * The call: recents don't disappear when pins exist, they get out of the
   * way. Anything already pinned is dropped from recents (a tool never
   * appears twice above the fold), and the remainder is trimmed to three. If
   * nothing survives, the section hides itself. What's left is exactly the
   * thing pins can't tell you: the tool you opened yesterday and haven't
   * committed to yet.
   */
  const recentTools = useMemo(() => {
    const hasPins = pinnedTools.length > 0;
    const pinnedSlugs = new Set(pinnedTools.map((t) => t.slug));
    return parseRecents(rawRecents)
      .map((slug) => TOOLS_BY_SLUG.get(slug))
      .filter((t): t is Tool => Boolean(t))
      .filter((t) => !pinnedSlugs.has(t.slug))
      .slice(0, hasPins ? MAX_RECENTS_ALONGSIDE_PINS : MAX_RECENTS);
  }, [rawRecents, pinnedTools]);

  // A dead pin button is worse than a briefly disabled one.
  const pinsLoading = pins === null;

  return (
    <div className="animate-fade-in mx-auto w-full max-w-6xl p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your bundle</p>
          <h1 className="title-2 mt-1.5">Pick a tool.</h1>
        </div>
        <p className="tnum font-mono text-xs text-muted-2">
          {TOOLS.length} tools · {CATEGORY_COUNT} categories
        </p>
      </div>

      <WelcomeCard />

      {/* Search */}
      <div className="relative mt-6 max-w-md">
        <span
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-2"
          aria-hidden
        >
          ⌕
        </span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, or by what it replaces…"
          className="input input-search w-full pr-16"
          aria-label="Search tools"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
          {searching ? (
            <span className="tnum font-mono text-[0.6875rem] text-muted-2">{totalMatches}</span>
          ) : (
            <kbd className="chip font-mono text-[0.625rem]">/</kbd>
          )}
        </span>
      </div>

      {pinError && (
        <div role="alert" className="alert-danger animate-fade-in mt-4 flex items-start gap-3">
          <span className="flex-1">{pinError}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss error"
            className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pinned — user-curated, so it outranks everything and gets real cards */}
      {!searching && pinnedTools.length > 0 && (
        <section className="animate-fade-in mt-8">
          <div className="flex items-center gap-2.5">
            <span className="text-accent" aria-hidden>
              <Glyph name="pin" filled size={13} />
            </span>
            <h2 className="text-[0.8125rem] font-semibold tracking-tight">Pinned</h2>
            <span className="tnum font-mono text-[0.6875rem] text-muted-2">
              {pinnedTools.length}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pinnedTools.map((tool, i) => (
              <ToolCard
                key={tool.slug}
                index={i}
                tool={tool}
                pinned
                busy={busy.has(tool.slug)}
                onTogglePin={toggle}
                onOpen={remember}
                className="pin-enter"
              />
            ))}
          </div>
        </section>
      )}

      {/* Recents — trimmed, and never repeating a pin. See recentTools above. */}
      {!searching && recentTools.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow">Jump back in</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/dashboard/${tool.slug}`}
                onClick={() => remember(tool.slug)}
                data-cat={categoryKey(tool.category)}
                className="card card-interactive flex items-center gap-2 rounded-full py-1.5 pr-4 pl-2 text-sm"
              >
                <span className="icon-tile icon-tile-cat size-7 text-[0.8125rem]" aria-hidden>
                  <ToolIcon slug={tool.slug} />
                </span>
                <span className="font-medium tracking-tight">{tool.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalMatches === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-sm text-muted">
            Nothing matches <span className="text-foreground">&ldquo;{query}&rdquo;</span>.
          </p>
          <button type="button" onClick={() => setQuery("")} className="btn btn-secondary mt-4">
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-9 flex flex-col gap-9">
          {groups.map((group) => (
            <section key={group.category} data-cat={categoryKey(group.category)}>
              <div className="flex items-center gap-2.5">
                <span className="cat-mark" aria-hidden />
                <h2 className="text-[0.8125rem] font-semibold tracking-tight">{group.category}</h2>
                <span className="tnum font-mono text-[0.6875rem] text-muted-2">
                  {group.tools.length}
                </span>
                <span className="cat-rule flex-1" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.tools.map((tool, i) => (
                  <ToolCard
                    key={tool.slug}
                    index={i}
                    tool={tool}
                    pinned={isPinned(tool.slug)}
                    busy={pinsLoading || busy.has(tool.slug)}
                    onTogglePin={toggle}
                    onOpen={remember}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
