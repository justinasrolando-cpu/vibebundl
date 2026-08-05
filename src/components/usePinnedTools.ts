"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Postgres unique_violation. Hit by a double-click racing itself. */
const UNIQUE_VIOLATION = "23505";

export type PinsState = {
  /** Pinned slugs in position order. `null` while the first read is in flight. */
  pins: string[] | null;
  isPinned: (slug: string) => boolean;
  /** In-flight slugs — the toggle is disabled for these. */
  busy: ReadonlySet<string>;
  toggle: (slug: string) => void;
  error: string | null;
  dismissError: () => void;
};

/**
 * Pinned tools, backed by `pinned_tools` and scoped to the signed-in user.
 *
 * Writes are optimistic: the card flips the instant you press it, and rolls
 * back with a visible message if the write fails. That's the whole reason
 * pinning feels free — a spinner on a one-bit toggle would cost more than
 * the action is worth.
 *
 * Two races are handled explicitly:
 *   · double-click — a per-slug busy set drops the second press, and a
 *     unique-violation coming back from the first is treated as success,
 *     because the row it collided with is the row we wanted.
 *   · unmount mid-write — a live ref stops the rollback touching state.
 */
export function usePinnedTools(): PinsState {
  const [pins, setPins] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        // The layout already gates on auth; nothing to show, nothing to say.
        setPins([]);
        return;
      }
      userIdRef.current = user.id;

      const { data, error: readError } = await supabase
        .from("pinned_tools")
        .select("tool_slug, position, created_at")
        .eq("user_id", user.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (readError) {
        setPins([]);
        setError("Couldn't load your pinned tools. Everything else still works.");
        return;
      }

      setPins((data ?? []).map((row: { tool_slug: string }) => row.tool_slug));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setBusyFor = useCallback((slug: string, on: boolean) => {
    setBusy((prev) => {
      if (prev.has(slug) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      const current = pins;
      const userId = userIdRef.current;
      if (current === null || busy.has(slug)) return;

      if (!userId) {
        setError("Your session expired. Refresh the page and sign in again.");
        return;
      }

      const wasPinned = current.includes(slug);
      const next = wasPinned ? current.filter((s) => s !== slug) : [...current, slug];

      setError(null);
      setPins(next); // optimistic
      setBusyFor(slug, true);

      (async () => {
        const supabase = createClient();
        try {
          if (wasPinned) {
            const { error: deleteError } = await supabase
              .from("pinned_tools")
              .delete()
              .eq("user_id", userId)
              .eq("tool_slug", slug);
            if (deleteError) throw deleteError;
          } else {
            const { error: insertError } = await supabase.from("pinned_tools").insert({
              user_id: userId, // set explicitly — never inferred from the session
              tool_slug: slug,
              position: current.length,
            });
            // A duplicate means the row already exists, which is the state we
            // were asking for. Nothing to roll back.
            if (insertError && insertError.code !== UNIQUE_VIOLATION) throw insertError;
          }
        } catch {
          if (!liveRef.current) return;
          setPins((live) =>
            live === null
              ? live
              : // Rebuild from the live list rather than restoring the old
                // snapshot, so a concurrent toggle on another tool survives.
                wasPinned
                ? live.includes(slug)
                  ? live
                  : [...live, slug]
                : live.filter((s) => s !== slug),
          );
          setError(
            wasPinned
              ? "Couldn't unpin that — it's still pinned. Try again in a moment."
              : "Couldn't save that pin. Try again in a moment.",
          );
        } finally {
          if (liveRef.current) setBusyFor(slug, false);
        }
      })();
    },
    [pins, busy, setBusyFor],
  );

  const isPinned = useCallback((slug: string) => pins?.includes(slug) ?? false, [pins]);
  const dismissError = useCallback(() => setError(null), []);

  return { pins, isPinned, busy, toggle, error, dismissError };
}
