"use client";

import { useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

// Soft client-side guard only: we remember in localStorage that this browser already
// voted so returning visitors land straight on the results. It is NOT vote integrity —
// clearing storage, using another browser, or hitting the API directly all bypass it.
function storageKey(slug: string) {
  return `poll_voted_${slug}`;
}

function markVotedLocally(slug: string, optionIndex: number) {
  try {
    window.localStorage.setItem(storageKey(slug), String(optionIndex));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

function readLocalChoice(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}

// Storage is read through useSyncExternalStore so the server render (always "not
// voted yet") hydrates cleanly before the browser's own answer takes over.
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function VoteBox({
  pollId,
  slug,
  options,
  initialCounts,
}: {
  pollId: string;
  slug: string;
  options: string[];
  initialCounts: number[];
}) {
  const supabase = createClient();

  const [counts, setCounts] = useState<number[]>(initialCounts);
  const [justVoted, setJustVoted] = useState<number | null>(null);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storedChoice = useSyncExternalStore(
    subscribeToStorage,
    () => readLocalChoice(slug),
    () => null,
  );

  const parsedStored =
    storedChoice === null ? null : Number.parseInt(storedChoice, 10);
  const myChoice =
    justVoted ?? (parsedStored !== null && !Number.isNaN(parsedStored) ? parsedStored : null);
  const voted = justVoted !== null || storedChoice !== null;

  async function handleVote(optionIndex: number) {
    if (voted || submittingIndex !== null) return;
    setSubmittingIndex(optionIndex);
    setError(null);

    const { error: insertError } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      option_index: optionIndex,
    });

    if (insertError) {
      setError(insertError.message || "Could not record your vote. Please try again.");
      setSubmittingIndex(null);
      return;
    }

    setCounts((prev) => prev.map((n, i) => (i === optionIndex ? n + 1 : n)));
    markVotedLocally(slug, optionIndex);
    setJustVoted(optionIndex);
    setSubmittingIndex(null);
  }

  const total = counts.reduce((sum, n) => sum + n, 0);

  if (options.length === 0) {
    return <p className="text-sm text-muted">This poll has no options to vote on yet.</p>;
  }

  if (voted) {
    return (
      <div className="flex flex-col gap-3">
        {options.map((option, i) => {
          const votes = counts[i] ?? 0;
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  {option}
                  {myChoice === i && <span className="ml-2 text-xs text-accent">your vote</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {votes} {votes === 1 ? "vote" : "votes"} · {pct}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted">
          {total} {total === 1 ? "vote" : "votes"} total · thanks for voting.
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((option, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleVote(i)}
          disabled={submittingIndex !== null}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {submittingIndex === i ? "Voting…" : option}
        </button>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
