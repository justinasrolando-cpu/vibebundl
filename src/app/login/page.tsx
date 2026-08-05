"use client";

import ToolIcon from "@/components/ToolIcon";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Spinner from "@/components/Spinner";
import { safeNext } from "@/lib/safe-path";
import { TOOLS, BUNDLE_PRICE_USD, TOTAL_ORIGINAL_PRICE, groupToolsByCategory, TOOL_COUNT_LABEL } from "@/lib/tools";

const TOTAL_ROUNDED = Math.round(TOTAL_ORIGINAL_PRICE);
const SAVINGS = Math.round(TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD);
const GROUPS = groupToolsByCategory();
/* One representative icon per category — the breadth at a glance, from data. */
const SAMPLE_ICONS = GROUPS.map((group) => group.tools[0]);
const MIN_PASSWORD = 6;
const RESEND_COOLDOWN = 30;

/* Deliberately permissive: catches typos like "me@gmail" without rejecting
   addresses that are unusual but valid. The mail server is the real judge. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validated, not merely prefix-checked: `startsWith("/")` lets
  // "//evil.com" through, and router.push() treats that as a hard
  // navigation off-site. See safe-path.ts.
  const next = safeNext(searchParams.get("next"));
  /* Purchase intent carried through signup. Someone who clicked "get all 50+
     — $19.99/mo" has already decided; showing them the paywall again is
     friction with no upside. `?checkout=1` sends them straight to Stripe the
     moment they have a session. */
  const wantsCheckout = searchParams.get("checkout") === "1";

  /**
   * Straight to Stripe. Falls back to the normal destination if the session
   * can't be created — a broken checkout must never strand someone on a blank
   * screen, and the SubscribeGate on /dashboard is a working second chance.
   */
  async function goToCheckoutOr(destination: string) {
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* fall through */
    }
    router.push(destination);
  }

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const signingIn = mode === "sign-in";

  const emailError = useMemo(() => {
    const value = email.trim();
    if (!value) return "Enter your email address.";
    if (!EMAIL_RE.test(value)) return "That doesn't look like an email address.";
    return null;
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return "Enter your password.";
    if (!signingIn && password.length < MIN_PASSWORD)
      return `Use at least ${MIN_PASSWORD} characters — you have ${password.length}.`;
    return null;
  }, [password, signingIn]);

  /* Errors surface once a field has been left, or once submit has been tried.
     After that they update live, so the message clears as you fix it. */
  const showEmailError = (touched.email || submitAttempted) && emailError;
  const showPasswordError = (touched.password || submitAttempted) && passwordError;

  function switchMode(nextMode: Mode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setFormError(null);
    setSubmitAttempted(false);
    setTouched({ email: false, password: false });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setFormError(null);

    if (emailError || passwordError) {
      (emailError ? emailRef : passwordRef).current?.focus();
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const cleanEmail = email.trim();

    if (signingIn) {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        setLoading(false);
        setFormError(friendlyError(error.message, "sign-in"));
        passwordRef.current?.focus();
        return;
      }
      /* Stay in the loading state through navigation — flipping the label back
         to "Sign in" for a frame reads as though nothing happened. */
      if (wantsCheckout) {
        await goToCheckoutOr(next);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setLoading(false);
      setFormError(friendlyError(error.message, "sign-up"));
      return;
    }
    /* With email confirmation disabled, signUp returns a live session — send
       them straight in (to Stripe, if they arrived with purchase intent).
       Otherwise session is null and the inbox step is next. */
    if (data.session) {
      if (wantsCheckout) {
        void goToCheckoutOr(next);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }
    setLoading(false);
    setAwaitingConfirmation(cleanEmail);
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden px-4">
      <div className="aura opacity-70" aria-hidden />
      <div className="grid-lines" aria-hidden />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col py-8 md:py-12">
        <Link
          href="/"
          className="mb-8 inline-flex w-fit items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span> back to the list
        </Link>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-16">
          <ValueProp />

          <div className="order-1 mx-auto w-full max-w-sm lg:order-2 lg:mx-0 lg:max-w-none">
            {awaitingConfirmation ? (
              <ConfirmEmail
                email={awaitingConfirmation}
                next={next}
                onUseAnotherEmail={() => {
                  setAwaitingConfirmation(null);
                  setPassword("");
                  setSubmitAttempted(false);
                  setTouched({ email: false, password: false });
                }}
              />
            ) : (
              <div className="card-raised animate-fade-in p-6">
                <div
                  role="tablist"
                  aria-label="Sign in or create an account"
                  className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1"
                >
                  {(["sign-in", "sign-up"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={mode === value}
                      data-active={mode === value}
                      onClick={() => switchMode(value)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 ease-out data-[active=true]:bg-surface-3 data-[active=true]:text-foreground data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]"
                    >
                      {value === "sign-in" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>

                <h2 className="title-2 mt-5">
                  {signingIn ? "Welcome back." : "Create your account."}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {signingIn
                    ? `All ${TOOL_COUNT_LABEL} tools, right where you left them.`
                    : `Takes a minute. You'll pick up the $${BUNDLE_PRICE_USD}/mo plan straight after.`}
                </p>

                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-3.5">
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    inputRef={emailRef}
                    error={showEmailError ? emailError : null}
                    onChange={setEmail}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  />

                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    autoComplete={signingIn ? "current-password" : "new-password"}
                    placeholder={signingIn ? "••••••••" : `At least ${MIN_PASSWORD} characters`}
                    value={password}
                    inputRef={passwordRef}
                    error={showPasswordError ? passwordError : null}
                    hint={signingIn ? undefined : `${MIN_PASSWORD} characters minimum.`}
                    onChange={setPassword}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  />

                  {formError && (
                    <p
                      role="alert"
                      className="animate-fade-in rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger"
                    >
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary btn-lg mt-1 w-full disabled:opacity-60"
                  >
                    {loading && <Spinner />}
                    {loading
                      ? signingIn
                        ? "Signing in…"
                        : "Creating account…"
                      : signingIn
                        ? "Sign in"
                        : "Create account"}
                  </button>
                </form>

                <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-2">
                  {signingIn ? (
                    <>
                      No account yet?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("sign-up")}
                        className="text-accent transition-opacity hover:opacity-80"
                      >
                        Create one
                      </button>{" "}
                      — {TOOL_COUNT_LABEL} tools for ${BUNDLE_PRICE_USD}/mo.
                    </>
                  ) : (
                    <>
                      Already have one?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("sign-in")}
                        className="text-accent transition-opacity hover:opacity-80"
                      >
                        Sign in
                      </button>{" "}
                      instead.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- pitch --- */

function ValueProp() {
  const points = [
    `${TOOL_COUNT_LABEL} tools across ${GROUPS.length} categories, all unlocked at once`,
    `Replaces about $${TOTAL_ROUNDED}/mo of separate subscriptions`,
    "One account, one bill, cancel any time",
  ];

  return (
    <section className="order-2 lg:order-1">
      <p className="font-mono text-xs text-accent">
        <span className="text-muted-2">$</span> auth --bundle
        <span className="caret" aria-hidden>
          ▍
        </span>
      </p>

      <h1 className="title-1 mt-4 max-w-lg">
        {TOOL_COUNT_LABEL} small tools. One login, one{" "}
        <span className="text-gradient">${BUNDLE_PRICE_USD}</span> bill.
      </h1>
      <p className="lede mt-4 max-w-md">
        Link in bio, invoicing, analytics, notes, forms, AI writing — the subscriptions you were
        paying for one at a time, behind a single account.
      </p>

      <ul className="mt-7 flex flex-col gap-2.5">
        {points.map((point, i) => (
          <li
            key={point}
            style={{ animationDelay: `${80 + i * 55}ms` }}
            className="animate-fade-in flex items-start gap-2.5 text-sm text-muted"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[0.5625rem] text-accent"
            >
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap items-center gap-1.5">
        {SAMPLE_ICONS.map((tool) => (
          <span key={tool.slug} className="icon-tile" title={tool.name} aria-hidden>
            <ToolIcon slug={tool.slug} />
          </span>
        ))}
        <span className="chip tnum ml-1">+{TOOLS.length - SAMPLE_ICONS.length} more</span>
      </div>

      <p className="tnum mt-6 text-xs text-muted-2">
        About ${SAVINGS}/mo cheaper than buying the originals.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------- form field --- */

function Field({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  value,
  error,
  hint,
  inputRef,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  value: string;
  error: string | null;
  hint?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={
          error
            ? "input border-danger focus:border-danger focus:[box-shadow:var(--highlight),0_0_0_3px_var(--danger-soft)]"
            : "input"
        }
      />
      {error ? (
        <p id={`${id}-error`} className="animate-fade-in text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------- email confirmation --- */

function ConfirmEmail({
  email,
  next,
  onUseAnotherEmail,
}: {
  email: string;
  next: string;
  onUseAnotherEmail: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    setResendError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setSending(false);
    if (error) {
      setResendError(error.message);
      return;
    }
    setResent(true);
    setCooldown(RESEND_COOLDOWN);
  }

  const steps = [
    "Open the email we just sent you.",
    "Tap the confirmation link inside it.",
    `You'll land back here signed in, ready to pick up the $${BUNDLE_PRICE_USD}/mo plan.`,
  ];

  return (
    <div className="card-raised animate-fade-in p-6" role="status" aria-live="polite">
      <span className="icon-tile icon-tile-lg" aria-hidden>
        ✉️
      </span>

      <h2 className="title-2 mt-4">Check your inbox.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Your account exists — it just needs one click to confirm the address is yours. The link is
        on its way to <span className="break-all text-foreground">{email}</span>.
      </p>

      <ol className="mt-5 flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm text-muted">
            <span
              aria-hidden
              className="tnum mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-[0.625rem] text-muted-2"
            >
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-2">
          Nothing after a minute? Check spam and promotions — then send it again.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resend}
            disabled={sending || cooldown > 0}
            className="btn btn-secondary text-xs disabled:opacity-50"
          >
            {sending && <Spinner />}
            {sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
          </button>
          <button type="button" onClick={onUseAnotherEmail} className="btn btn-ghost text-xs">
            Use a different address
          </button>
        </div>

        {resendError ? (
          <p role="alert" className="animate-fade-in mt-3 text-xs text-danger">
            {resendError}
          </p>
        ) : (
          resent && (
            <p className="animate-fade-in mt-3 text-xs text-accent">
              Sent again — check your inbox.
            </p>
          )
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- errors --- */

/** Supabase's messages are accurate but terse; these are the ones that matter. */
function friendlyError(message: string, mode: Mode) {
  const lower = message.toLowerCase();
  if (mode === "sign-in" && lower.includes("invalid login credentials"))
    return "That email and password don't match an account. Check the password — or create an account instead.";
  if (lower.includes("already registered") || lower.includes("already been registered"))
    return "There's already an account with that email. Switch to Sign in.";
  if (lower.includes("email not confirmed"))
    return "This account still needs confirming. Open the link in the email we sent you.";
  return message;
}
