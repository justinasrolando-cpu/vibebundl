"use client";

import ToolIcon from "@/components/ToolIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { categoryKey, type Category, type Tool } from "@/lib/tools";

export type ToolGroup = { category: Category; tools: Tool[] };

/**
 * Sidebar navigation for 53 tools.
 *
 * A flat list of 53 links is a wall. This collapses to seven category
 * headers, auto-opens the one you're currently in, and adds a filter so
 * you can jump anywhere in two keystrokes without scrolling.
 */
export default function ToolNav({
  groups,
  hasAccess,
  onNavigate,
}: {
  groups: ToolGroup[];
  hasAccess: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeSlug = pathname?.startsWith("/dashboard/") ? pathname.split("/")[2] : undefined;

  const activeCategory = useMemo(
    () => groups.find((g) => g.tools.some((t) => t.slug === activeSlug))?.category,
    [groups, activeSlug],
  );

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        category: g.category,
        tools: g.tools.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.replaces.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.tools.length > 0);
  }, [groups, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative px-1">
        <span
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-muted-2"
          aria-hidden
        >
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tools"
          aria-label="Filter tools"
          className="input input-search w-full text-[0.8125rem]"
        />
      </div>

      <nav className="scroll-slim mt-3 -mr-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-2 pb-2">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-xs text-muted-2">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {filtered.map((group) => {
          // Searching always reveals results; otherwise remember what the user closed.
          const open = searching || !collapsed[group.category];
          return (
            // Publishes --cat to the header dot, so seven collapsed rows are
            // told apart by colour before they're read.
            <div key={group.category} data-cat={categoryKey(group.category)}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [group.category]: !prev[group.category] }))
                }
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  className="text-[0.5rem] text-muted-2 transition-transform duration-150"
                  style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                  aria-hidden
                >
                  ▶
                </span>
                <span className="cat-mark" aria-hidden />
                <span className="eyebrow flex-1 truncate">{group.category}</span>
                <span className="tnum font-mono text-[0.625rem] text-muted-2">
                  {group.tools.length}
                </span>
                {!open && activeCategory === group.category && (
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                )}
              </button>

              {/* 0fr → 1fr keeps the reveal on the compositor, no height math. */}
              <div
                className="grid transition-[grid-template-rows] duration-[180ms] ease-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="mt-0.5 flex flex-col gap-px pb-1">
                    {group.tools.map((tool) => {
                      const active = tool.slug === activeSlug;
                      return (
                        <Link
                          key={tool.slug}
                          href={hasAccess ? `/dashboard/${tool.slug}` : "/dashboard"}
                          onClick={onNavigate}
                          data-active={active}
                          aria-current={active ? "page" : undefined}
                          tabIndex={open ? undefined : -1}
                          className="nav-item"
                        >
                          <span className="w-4 shrink-0 text-center text-[0.8125rem]" aria-hidden>
                            <ToolIcon slug={tool.slug} />
                          </span>
                          <span className="truncate">{tool.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
