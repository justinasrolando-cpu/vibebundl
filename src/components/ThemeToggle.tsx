"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/components/ThemeScript";

type Theme = "dark" | "light";

/**
 * The daylight switch.
 *
 * State lives on the <html> element, not in React — ThemeScript already put
 * it there before first paint, so reading it back is the only way to start
 * in sync. Rendering the icon from React state before mount would produce a
 * sun on a dark page for one frame, so the glyph is hidden until mounted and
 * the button keeps its footprint. That trades a brief blank square for never
 * showing the wrong icon, which is the right way round: a missing glyph
 * reads as "loading", a wrong one reads as "broken".
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  // Follow the OS if — and only if — the user has never picked for themselves.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      const next: Theme = e.matches ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Private mode. The theme still applies for this page — it just
         won't survive a reload, which beats throwing on a click. */
    }
    setTheme(next);
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors duration-[var(--dur-fast)] hover:border-border-strong hover:text-foreground ${className}`}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Dark" : "Daylight"}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`h-4 w-4 fill-none stroke-current stroke-[1.6] transition-opacity duration-[var(--dur-fast)] ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isLight ? (
          /* Currently light → offer the moon. */
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
