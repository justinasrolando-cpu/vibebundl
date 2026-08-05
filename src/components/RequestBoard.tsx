"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Request a tool — the growth loop.
 *
 * This is an *unauthenticated public write*, which is the whole reason the
 * top half of this file is about spam rather than about forms. Four cheap
 * layers, none of which is load-bearing on its own:
 *
 *   1. a honeypot field a human never sees and never fills
 *   2. a minimum length on the one required field
 *   3. a localStorage cooldown between submissions
 *   4. trimmed, hard-capped strings, so a 2MB "SaaS name" can't be inserted
 *
 * Layers 1 and 3 are client-side and therefore trivially bypassed by anyone
 * writing curl. They exist to stop drive-by bot traffic, not a determined
 * human. Real integrity would need a server-side rate limit keyed on IP; the
 * RLS policy deliberately allows insert-only, so the worst case is junk rows
 * on the board rather than anything reaching a customer.
 */

// ---------------------------------------------------------------------------
// Shape and limits
// ---------------------------------------------------------------------------

/**
 * The public projection. `notify_email` is NOT in this list and must never be:
 * RLS can't restrict a single column, so the column stays private by never
 * being asked for. Anything added here is visible to the entire internet.
 */
const PUBLIC_COLUMNS =
  "id, saas_name, saas_url, monthly_price, reason, difficulty, status, shipped_slug, votes, created_at";

type RequestRow = {
  id: string;
  saas_name: string;
  saas_url: string;
  monthly_price: number | string | null;
  reason: string;
  difficulty: number;
  status: string;
  shipped_slug: string;
  votes: number;
  created_at: string;
};

const LIMITS = {
  name: 80,
  url: 300,
  reason: 600,
  email: 160,
} as const;

const MIN_NAME_LENGTH = 2;
const MAX_MONTHLY_PRICE = 100_000;

/** One submission per 30 seconds, per browser. */
const SUBMIT_COOLDOWN_MS = 30_000;

const LAST_SUBMIT_KEY = "vb_request_last_submit";
const VOTED_KEY = "vb_request_votes";

// ---------------------------------------------------------------------------
// localStorage — every read and write is failure-tolerant. Private browsing
// and full quotas are normal, and neither should break the page.
// ---------------------------------------------------------------------------

function readLastSubmit(): number {
  try {
    const raw = window.localStorage.getItem(LAST_SUBMIT_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastSubmit(at: number) {
  try {
    window.localStorage.setItem(LAST_SUBMIT_KEY, String(at));
  } catch {
    /* storage unavailable — the cooldown is a courtesy, not a guarantee */
  }
}

/**
 * Soft vote guard. Remembering which ids this browser has already upvoted
 * stops an accidental double-press and casual repeat clicking. It is NOT vote
 * integrity — clearing storage, opening a second browser, or calling the RPC
 * directly all bypass it, and the RPC is intentionally happy to be called.
 */
function readVotedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(VOTED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeVotedIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(VOTED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Adds a scheme so `figma.com` typed into the box still resolves. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return null;
    return parsed.toString().slice(0, LIMITS.url);
  } catch {
    return null;
  }
}

function priceLabel(value: RequestRow["monthly_price"]): string | null {
  if (value === null || value === "") return null;
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}/mo`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormatter.format(d);
}

// ---------------------------------------------------------------------------
// Slider chrome
//
// The design system has no range input, and globals.css isn't ours to edit —
// so the styles ride along with the component. React hoists a <style> that
// carries a `precedence`, and dedupes it by `href`, so mounting the form
// twice still yields one rule set.
// ---------------------------------------------------------------------------

const RANGE_CSS = `
.vb-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: transparent;
  cursor: pointer;
  /* The track is 6px; the padding buys a 24px hit area around it without
     moving the track off centre. A 6px-tall control is a 6px-tall target. */
  padding: 9px 0;
}
.vb-range:focus { outline: none; }
.vb-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--accent) 0 var(--vb-pct),
    var(--surface-3) var(--vb-pct) 100%
  );
}
.vb-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border-radius: 999px;
  background-image: linear-gradient(180deg, var(--accent-lift), var(--accent-sink));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), var(--shadow-sm);
  transition:
    transform var(--dur-press) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}
.vb-range:active::-webkit-slider-thumb { transform: scale(0.92); }
.vb-range:focus-visible::-webkit-slider-thumb {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 0 3px var(--accent-soft);
}
.vb-range::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-3);
}
.vb-range::-moz-range-progress {
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
}
.vb-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 999px;
  background-image: linear-gradient(180deg, var(--accent-lift), var(--accent-sink));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), var(--shadow-sm);
}
@media (prefers-reduced-motion: reduce) {
  .vb-range:active::-webkit-slider-thumb { transform: none; }
}
`;

// ---------------------------------------------------------------------------
// The page body
// ---------------------------------------------------------------------------

const LOAD_ERROR = "Couldn't load the board. Refresh, or try again in a moment.";

/** The board query, in one place: the first load and every retry share it. */
async function fetchRequests(): Promise<RequestRow[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_requests")
    .select(PUBLIC_COLUMNS)
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return null;
  return (data ?? []) as unknown as RequestRow[];
}

export default function RequestBoard() {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rows = await fetchRequests();
      if (cancelled) return;
      setLoadError(rows === null ? LOAD_ERROR : null);
      setRequests(rows ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-read after a submit, or when the reader presses "try again". */
  const load = useCallback(async () => {
    const rows = await fetchRequests();
    setLoadError(rows === null ? LOAD_ERROR : null);
    setRequests(rows ?? []);
  }, []);

  return (
    <>
      <RequestForm onSubmitted={load} />
      <Board
        requests={requests}
        error={loadError}
        onRetry={load}
        onOptimisticVote={(id, delta) =>
          setRequests((prev) =>
            prev === null
              ? prev
              : prev.map((r) => (r.id === id ? { ...r, votes: r.votes + delta } : r)),
          )
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function RequestForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [difficulty, setDifficulty] = useState(5);
  const [email, setEmail] = useState("");
  /** The honeypot. A human never sees this field, so a value means a bot. */
  const [website, setWebsite] = useState("");

  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  function reset() {
    setName("");
    setUrl("");
    setPrice("");
    setReason("");
    setDifficulty(5);
    setEmail("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (state === "submitting") return;
    setError(null);

    // 1. Honeypot. Show the success state rather than an error — telling a bot
    //    which field gave it away is free tuning advice.
    if (website.trim() !== "") {
      setState("done");
      setNotified(false);
      reset();
      return;
    }

    // 2. Minimum length on the required field.
    const cleanName = name.trim().slice(0, LIMITS.name);
    if (cleanName.length < MIN_NAME_LENGTH) {
      setError(`Give us at least ${MIN_NAME_LENGTH} characters of a name.`);
      return;
    }

    // 3. Cooldown.
    const since = Date.now() - readLastSubmit();
    if (since < SUBMIT_COOLDOWN_MS) {
      const wait = Math.ceil((SUBMIT_COOLDOWN_MS - since) / 1000);
      setError(`One request at a time — try again in ${wait}s.`);
      return;
    }

    // 4. Trim and cap everything that reaches the database.
    const cleanUrl = normalizeUrl(url);
    if (cleanUrl === null) {
      setError("That URL doesn't look right. Leave it blank if you're not sure.");
      return;
    }

    const cleanEmail = email.trim().slice(0, LIMITS.email);
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("That email doesn't look right. Leave it blank if you'd rather not hear from us.");
      return;
    }

    const parsedPrice = price.trim() === "" ? null : Number.parseFloat(price);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError("Monthly price should be a number, or blank.");
      return;
    }

    setState("submitting");
    const supabase = createClient();

    // Attach the account when there is one, so we can tell them it shipped
    // without needing the email a second time.
    let userId: string | null = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      /* anonymous is the normal case here — never block on this */
    }

    const { error: insertError } = await supabase.from("tool_requests").insert({
      user_id: userId,
      saas_name: cleanName,
      saas_url: cleanUrl,
      monthly_price: parsedPrice === null ? null : Math.min(parsedPrice, MAX_MONTHLY_PRICE),
      reason: reason.trim().slice(0, LIMITS.reason),
      difficulty: Math.min(10, Math.max(1, Math.round(difficulty))),
      notify_email: cleanEmail,
    });

    if (insertError) {
      setState("idle");
      setError("Couldn't save that request. Try again in a moment.");
      return;
    }

    writeLastSubmit(Date.now());
    setNotified(cleanEmail.length > 0);
    setState("done");
    reset();
    await onSubmitted();
  }

  const pct = ((difficulty - 1) / 9) * 100;

  return (
    <form onSubmit={handleSubmit} className="card card-raised mt-8 p-6 sm:p-8" noValidate>
      <style href="vb-range" precedence="medium">
        {RANGE_CSS}
      </style>

      <p className="eyebrow">Request a tool</p>
      <h2 className="title-2 mt-2">What are you still paying for?</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        Name the subscription. If enough people want it, it goes in the bundle — at no extra
        charge, like everything else.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SaaS name" htmlFor="saas_name" required>
          <input
            id="saas_name"
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.name}
            placeholder="Notion, Figma, Zapier…"
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Their site" htmlFor="saas_url" hint="optional · full link, e.g. https://notion.so">
          <input
            id="saas_url"
            className="input w-full"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={LIMITS.url}
            placeholder="notion.so"
            inputMode="url"
            autoComplete="off"
          />
        </Field>

        <Field label="What it costs you" htmlFor="monthly_price" hint="per month, optional">
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-2"
              aria-hidden
            >
              $
            </span>
            <input
              id="monthly_price"
              className="input tnum w-full pl-7"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              maxLength={12}
              placeholder="12"
              autoComplete="off"
            />
          </div>
        </Field>

        <Field label="Your email" htmlFor="notify_email" hint="optional · only used to tell you when it ships">
          <input
            id="notify_email"
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={LIMITS.email}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Why you want it" htmlFor="reason" hint="optional">
          <textarea
            id="reason"
            className="input w-full"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={LIMITS.reason}
            placeholder="What you actually use it for — the one feature that keeps you subscribed."
          />
        </Field>
      </div>

      {/* Difficulty */}
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="difficulty" className="text-xs text-muted">
            How hard do you reckon this is to vibecode?
          </label>
          <span className="tnum chip chip-accent">{difficulty} / 10</span>
        </div>

        <input
          id="difficulty"
          type="range"
          min={1}
          max={10}
          step={1}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          className="vb-range mt-3"
          style={{ "--vb-pct": `${pct}%` } as React.CSSProperties}
          aria-valuetext={`${difficulty} out of 10`}
        />

        <div className="mt-2 flex justify-between text-[0.6875rem] text-muted-2">
          <span>1 — one prompt</span>
          <span>10 — good luck</span>
        </div>
      </div>

      {/*
        The honeypot. Positioned off-screen rather than `display: none` —
        some bots skip hidden inputs but happily fill positioned ones. Hidden
        from assistive tech and from the tab order, so no human ever meets it.
      */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="alert-danger animate-fade-in mt-5">
          {error}
        </p>
      )}

      {state === "done" && !error && (
        <p role="status" className="alert-accent animate-fade-in mt-5">
          Logged it — it&apos;s on the board below.{" "}
          {notified
            ? "We'll email you the day it ships."
            : "Upvotes decide what we build next, so go and vote for it."}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-lg" disabled={state === "submitting"}>
          {state === "submitting" ? "Sending…" : "Send the request"}
        </button>
        <p className="text-xs text-muted-2">No account needed.</p>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-xs text-muted">
        {label}
        {required && (
          <span className="text-accent" aria-hidden>
            *
          </span>
        )}
        {hint && <span className="text-[0.6875rem] text-muted-2">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const STATUS_META: Record<string, { label: string; className: string }> = {
  requested: { label: "Requested", className: "chip" },
  planned: { label: "Planned", className: "chip border-border-strong text-foreground" },
  building: { label: "Building", className: "chip chip-accent" },
  shipped: { label: "Shipped", className: "chip chip-accent" },
  declined: { label: "Not building", className: "chip text-muted-2" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.requested;
  return (
    <span className={meta.className}>
      {status === "building" && (
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      )}
      {status === "shipped" && (
        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
      {meta.label}
    </span>
  );
}

function DifficultyMeter({ value }: { value: number }) {
  const n = Math.min(10, Math.max(1, Math.round(value)));
  return (
    <span className="flex items-center gap-2" title={`Submitter's guess: ${n} out of 10`}>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-[3px] rounded-full ${i < n ? "bg-muted" : "bg-surface-3"}`}
          />
        ))}
      </span>
      <span className="tnum">{n}/10 to build</span>
    </span>
  );
}

function Board({
  requests,
  error,
  onRetry,
  onOptimisticVote,
}: {
  requests: RequestRow[] | null;
  error: string | null;
  onRetry: () => Promise<void>;
  onOptimisticVote: (id: string, delta: 1 | -1) => void;
}) {
  // Read at first render rather than in an effect. There is no hydration risk:
  // the board is still `null` (skeletons) on both the server render and the
  // hydrating client render, so no button exists yet to disagree about.
  const [voted, setVoted] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readVotedIds(),
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [voteError, setVoteError] = useState<string | null>(null);

  const vote = useCallback(
    async (id: string) => {
      if (voted.has(id) || pending.has(id)) return;

      setVoteError(null);
      setPending((prev) => new Set(prev).add(id));

      // Optimistic: the count moves the instant you press. The board is NOT
      // re-sorted — rows leaping past each other under the cursor is a worse
      // experience than a momentarily out-of-order list, and the next load
      // settles it.
      onOptimisticVote(id, 1);
      const nextVoted = new Set(voted).add(id);
      setVoted(nextVoted);
      writeVotedIds(nextVoted);

      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("increment_tool_request_vote", {
        request_id: id,
      });

      if (rpcError) {
        onOptimisticVote(id, -1);
        const reverted = new Set(nextVoted);
        reverted.delete(id);
        setVoted(reverted);
        writeVotedIds(reverted);
        setVoteError("Couldn't record that vote. Try again in a moment.");
      }

      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [voted, pending, onOptimisticVote],
  );

  return (
    <section className="mt-[var(--section-gap)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">The board</p>
          <h2 className="title-1 mt-2">Most wanted, in order.</h2>
        </div>
        {requests !== null && requests.length > 0 && (
          <p className="tnum font-mono text-xs text-muted-2">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="alert-danger mt-6 flex flex-wrap items-center gap-3">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void onRetry()} className="btn btn-secondary text-xs">
            Try again
          </button>
        </div>
      )}

      {voteError && (
        <p role="alert" className="alert-danger animate-fade-in mt-6">
          {voteError}
        </p>
      )}

      {requests === null ? (
        <ul className="mt-6 flex flex-col gap-2.5" aria-busy="true" aria-label="Loading requests">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card flex animate-pulse gap-4 p-4">
              <span className="h-14 w-12 shrink-0 rounded-lg bg-surface-2" />
              <span className="flex-1 space-y-2 py-1">
                <span className="block h-3.5 w-1/3 rounded bg-surface-2" />
                <span className="block h-3 w-2/3 rounded bg-surface-2" />
              </span>
            </li>
          ))}
        </ul>
      ) : requests.length === 0 && !error ? (
        <div className="card mt-6 p-10 text-center">
          <p className="text-sm text-muted">Nothing on the board yet.</p>
          <p className="mt-1 text-xs text-muted-2">
            The first request is the easiest one to get built — there&apos;s nothing to outvote.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {requests.map((request, i) => (
            <RequestCard
              key={request.id}
              request={request}
              index={i}
              voted={voted.has(request.id)}
              pending={pending.has(request.id)}
              onVote={vote}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestCard({
  request,
  index,
  voted,
  pending,
  onVote,
}: {
  request: RequestRow;
  index: number;
  voted: boolean;
  pending: boolean;
  onVote: (id: string) => void;
}) {
  const host = request.saas_url ? hostOf(request.saas_url) : null;
  const price = priceLabel(request.monthly_price);
  const shipped = request.status === "shipped" && request.shipped_slug !== "";

  return (
    <li
      className="card animate-fade-in flex gap-4 p-4"
      style={{ animationDelay: `${Math.min(index * 25, 150)}ms` }}
    >
      <button
        type="button"
        onClick={() => onVote(request.id)}
        disabled={voted || pending}
        aria-pressed={voted}
        aria-label={
          voted ? `Already upvoted ${request.saas_name}` : `Upvote ${request.saas_name}`
        }
        className={[
          "btn h-14 w-12 shrink-0 flex-col gap-0.5 rounded-lg border px-0",
          voted
            ? "border-[color:var(--border-accent)] bg-[color:var(--accent-soft)] text-accent"
            : "border-border-strong bg-surface-2 text-muted hover:text-foreground",
          "disabled:cursor-default",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V6" />
          <path d="M5.5 12.5L12 6l6.5 6.5" />
        </svg>
        <span className="tnum text-sm font-semibold text-foreground">{request.votes}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[0.9375rem] font-semibold tracking-tight">{request.saas_name}</h3>
          <StatusBadge status={request.status} />
          {price && <span className="tnum chip font-mono text-muted-2">{price}</span>}
        </div>

        {host && (
          <a
            href={request.saas_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1 inline-block text-xs text-muted-2 underline decoration-border-strong underline-offset-2 transition-colors hover:text-foreground"
          >
            {host}
          </a>
        )}

        {request.reason && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{request.reason}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.6875rem] text-muted-2">
          <DifficultyMeter value={request.difficulty} />
          <span className="tnum">{dateLabel(request.created_at)}</span>
          {shipped && (
            <Link
              href={`/dashboard/${request.shipped_slug}`}
              className="text-accent transition-opacity hover:opacity-80"
            >
              Open it in your bundle →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
