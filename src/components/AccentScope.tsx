"use client";

import { createContext, useContext, useState } from "react";
import { DEFAULT_ACCENT, type AccentValue } from "@/lib/accents";

/**
 * Publishes the user's accent choice as `data-accent` on the app shell.
 *
 * Everything below it re-tints from CSS alone (see "Accent themes" in
 * globals.css) — no component knows a colour, and nothing needs to
 * re-render when the accent changes.
 *
 * The value is server-rendered from `user_profiles.accent`, so there is
 * no flash of green before a preference loads. Local state exists only so
 * the picker in Settings can preview a choice on the whole app the moment
 * you press a swatch, before the round-trip finishes.
 */

export {
  ACCENTS,
  DEFAULT_ACCENT,
  isAccent,
  normalizeAccent,
  type AccentValue,
} from "@/lib/accents";

type AccentContextValue = {
  accent: AccentValue;
  setAccent: (next: AccentValue) => void;
};

const AccentContext = createContext<AccentContextValue>({
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

export function useAccent() {
  return useContext(AccentContext);
}

export default function AccentScope({
  accent: serverAccent,
  className,
  children,
}: {
  accent: AccentValue;
  className?: string;
  children: React.ReactNode;
}) {
  const [accent, setAccent] = useState<AccentValue>(serverAccent);
  const [lastServerAccent, setLastServerAccent] = useState<AccentValue>(serverAccent);

  // Re-sync after a router.refresh() so the server stays the source of truth.
  // Adjusted during render rather than in an effect: this way the corrected
  // value paints in the same commit, with no frame in the stale colour.
  if (serverAccent !== lastServerAccent) {
    setLastServerAccent(serverAccent);
    setAccent(serverAccent);
  }

  return (
    <AccentContext value={{ accent, setAccent }}>
      <div data-accent={accent} className={className}>
        {children}
      </div>
    </AccentContext>
  );
}
