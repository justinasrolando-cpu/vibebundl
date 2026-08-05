"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Poll = {
  id: string;
  user_id: string;
  slug: string;
  question: string;
  options: string[] | null;
  created_at: string;
};

type VoteRow = {
  poll_id: string;
  option_index: number;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PollsPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [counts, setCounts] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [question, setQuestion] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";

  async function load(ownerId?: string | null) {
    setLoading(true);
    setError(null);

    const uid = ownerId ?? userId;
    if (!uid) {
      setPolls([]);
      setCounts({});
      setError("You are signed out. Sign in again to see your polls.");
      setLoading(false);
      return;
    }

    // NOTE: polls has BOTH a public select policy and an owner policy, so the
    // user_id filter below is required — RLS alone would return every user's rows.
    const { data: pollData, error: pollError } = await supabase
      .from("polls")
      .select("id, user_id, slug, question, options, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (pollError) {
      setError(pollError.message);
      setLoading(false);
      return;
    }

    const list = (pollData ?? []) as Poll[];
    setPolls(list);

    if (list.length > 0) {
      const { data: voteData, error: voteError } = await supabase
        .from("poll_votes")
        .select("poll_id, option_index")
        .in(
          "poll_id",
          list.map((p) => p.id),
        );

      if (voteError) {
        setError(voteError.message);
        setLoading(false);
        return;
      }

      const tally: Record<string, number[]> = {};
      for (const poll of list) {
        tally[poll.id] = new Array((poll.options ?? []).length).fill(0);
      }
      for (const vote of (voteData ?? []) as VoteRow[]) {
        const row = tally[vote.poll_id];
        if (row && vote.option_index >= 0 && vote.option_index < row.length) {
          row[vote.option_index] += 1;
        }
      }
      setCounts(tally);
    } else {
      setCounts({});
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await load(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleQuestionChange(value: string) {
    setQuestion(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  function resetForm() {
    setQuestion("");
    setSlug("");
    setSlugTouched(false);
    setOptions(["", ""]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError("Question is required.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Add at least 2 non-empty options.");
      return;
    }

    const cleanSlug = slugify(slug || question);
    if (!cleanSlug) {
      setError("Slug is required — use letters or numbers.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("polls").insert({
      user_id: userId,
      slug: cleanSlug,
      question: cleanQuestion,
      options: cleanOptions,
    });

    if (insertError) {
      setError(
        insertError.code === "23505" ? "That slug is already taken." : insertError.message,
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    resetForm();
    await load();
  }

  async function handleDelete(poll: Poll) {
    if (
      !confirm(`Delete "${poll.question}"? Its votes will be removed too. This cannot be undone.`)
    ) {
      return;
    }

    setDeletingId(poll.id);
    setError(null);

    const { error: deleteError } = await supabase.from("polls").delete().eq("id", poll.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    setPolls((prev) => prev.filter((p) => p.id !== poll.id));
    setCounts((prev) => {
      const next = { ...prev };
      delete next[poll.id];
      return next;
    });
    setDeletingId(null);
  }

  async function handleCopy(poll: Poll) {
    const url = `${publicOrigin}/poll/${poll.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(poll.id);
      setTimeout(() => setCopiedId((id) => (id === poll.id ? null : id)), 1500);
    } catch {
      setError("Could not copy to clipboard — copy the URL manually.");
    }
  }

  const previewSlug = slugify(slug || question);

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Polls</h1>
          <p className="mt-1 text-sm text-muted">
            Ask one question, share a link, collect votes. Results are counted
            when this page loads — hit Refresh for the latest. Votes are
            anonymous and limited to one per browser (a soft check, not
            ballot-box security).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary shrink-0"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <form onSubmit={handleCreate} className="card animate-fade-in mt-6 flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">New poll</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="question">
              Question
            </label>
            <input
              id="question"
              className="input"
              value={question}
              onChange={(e) => handleQuestionChange(e.target.value)}
              placeholder="What should we build next?"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="what-should-we-build-next"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Options (minimum 2)</span>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              <button
                type="button"
                className="btn btn-secondary text-danger"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                title={options.length <= 2 ? "A poll needs at least 2 options" : "Remove option"}
              >
                Remove
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-secondary" onClick={addOption}>
              + Add option
            </button>
          </div>
        </div>

        {previewSlug && (
          <p className="text-xs text-muted">
            Public URL:{" "}
            <span className="text-foreground">
              {publicOrigin}/poll/{previewSlug}
            </span>
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create poll"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : polls.length === 0 ? (
          <div className="card p-4 text-sm text-muted">
            No polls yet. Create one above and share its public link to start collecting votes.
          </div>
        ) : (
          polls.map((poll, index) => {
            const opts = poll.options ?? [];
            const tally = counts[poll.id] ?? new Array(opts.length).fill(0);
            const total = tally.reduce((sum, n) => sum + n, 0);

            return (
              <div
                key={poll.id}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                className="card animate-fade-in flex flex-col gap-3 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{poll.question}</p>
                    <p className="truncate text-xs text-muted">
                      {publicOrigin}/poll/{poll.slug} · {total} {total === 1 ? "vote" : "votes"} ·{" "}
                      {formatDate(poll.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => handleCopy(poll)}>
                      {copiedId === poll.id ? "Copied!" : "Copy link"}
                    </button>
                    <a
                      href={`/poll/${poll.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary text-danger"
                      onClick={() => handleDelete(poll)}
                      disabled={deletingId === poll.id}
                    >
                      {deletingId === poll.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {opts.length === 0 ? (
                  <p className="text-xs text-muted">This poll has no options.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {opts.map((option, i) => {
                      const votes = tally[i] ?? 0;
                      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate">{option}</span>
                            <span className="shrink-0 text-muted">
                              {votes} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
