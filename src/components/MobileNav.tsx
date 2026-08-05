"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ToolNav, { type ToolGroup } from "./ToolNav";
import SignOutButton from "./SignOutButton";
import SettingsLink from "./SettingsLink";
import ThemeToggle from "./ThemeToggle";

/**
 * Mobile chrome for the app shell. Without this the sidebar simply vanishes
 * under md and there is no way to reach another tool — a dead end.
 */
export default function MobileNav({
  groups,
  hasAccess,
  email,
  displayName = "",
}: {
  groups: ToolGroup[];
  hasAccess: boolean;
  email: string;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <header className="chrome sticky top-0 z-30 flex items-center gap-3 border-b border-border px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open tool menu"
          aria-expanded={open}
          className="btn btn-secondary -ml-1 px-2.5 text-xs"
        >
          <span aria-hidden>☰</span>
          Tools
        </button>
        <Link href="/dashboard" className="ml-auto text-sm font-semibold tracking-tight">
          vibe<span className="text-accent">bundl</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Kept mounted so open and close both transition. */}
      <div
        className="fixed inset-0 z-50 md:hidden"
        style={{ pointerEvents: open ? "auto" : "none" }}
        inert={!open}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ease-out"
          style={{ opacity: open ? 1 : 0 }}
        />
        <div
          role="dialog"
          aria-modal={open || undefined}
          aria-label="Tools"
          className="card-raised absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col rounded-none rounded-r-2xl border-r border-border p-3 transition-transform duration-[240ms] ease-out"
          style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
        >
          <div className="flex items-center justify-between px-1 pb-3">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold tracking-tight"
            >
              vibe<span className="text-accent">bundl</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close tool menu"
              className="btn btn-ghost px-2 text-xs"
            >
              ✕
            </button>
          </div>

          <ToolNav groups={groups} hasAccess={hasAccess} onNavigate={() => setOpen(false)} />

          <div className="mt-2 border-t border-border pt-2">
            <div className="px-2 py-1">
              {displayName && (
                <p className="truncate text-xs font-medium tracking-tight">{displayName}</p>
              )}
              <p className="truncate text-[0.6875rem] text-muted-2">{email}</p>
            </div>
            <SettingsLink onNavigate={() => setOpen(false)} />
            <SignOutButton />
          </div>
        </div>
      </div>
    </>
  );
}
