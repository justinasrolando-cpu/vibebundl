"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "feedback_voted_posts";

function getVotedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markVoted(postId: string) {
  const ids = getVotedIds();
  ids.add(postId);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export default function UpvoteButton({
  postId,
  initialVotes,
}: {
  postId: string;
  initialVotes: number;
}) {
  const supabase = createClient();
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setVoted(getVotedIds().has(postId));
  }, [postId]);

  async function handleVote() {
    if (voted || submitting) return;
    setSubmitting(true);
    setFailed(false);

    // optimistic bump
    setVotes((v) => v + 1);
    setVoted(true);

    const { error } = await supabase.rpc("increment_feedback_vote", {
      post_id: postId,
    });

    if (error) {
      // roll back on failure — and do NOT persist the vote locally, otherwise
      // a failed vote would lock this browser out of voting forever.
      setVotes((v) => v - 1);
      setVoted(false);
      setFailed(true);
    } else {
      markVoted(postId);
    }

    setSubmitting(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleVote}
        disabled={voted || submitting}
        className={`flex w-full shrink-0 flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs transition-colors ${
          voted
            ? "border-border bg-surface-hover text-muted"
            : "border-border bg-surface text-foreground hover:bg-surface-hover"
        }`}
        aria-pressed={voted}
        title={voted ? "You already voted for this" : "Upvote"}
      >
        <span aria-hidden className={voted ? "text-muted" : "text-accent"}>
          ▲
        </span>
        <span className="mt-0.5 font-medium">{votes}</span>
      </button>
      {failed && (
        <p className="text-center text-[10px] leading-tight text-danger">
          Vote failed
        </p>
      )}
    </div>
  );
}
