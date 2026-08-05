"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACCENTS, useAccent, type AccentValue } from "@/components/AccentScope";
import Glyph from "@/components/Glyph";
import Spinner from "@/components/Spinner";
import { BUNDLE_PRICE_USD, TOOLS } from "@/lib/tools";

const MAX_NAME = 60;

/** How Stripe's status strings read to a person, and what they mean here. */
const STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  active: { label: "Active", tone: "good" },
  trialing: { label: "Trialing", tone: "good" },
  past_due: { label: "Payment past due", tone: "warn" },
  incomplete: { label: "Payment incomplete", tone: "warn" },
  unpaid: { label: "Unpaid", tone: "bad" },
  canceled: { label: "Canceled", tone: "bad" },
  paused: { label: "Paused", tone: "warn" },
};

function Section({
  title,
  description,
  children,
  danger = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className="card p-5 md:p-6"
      style={danger ? { borderColor: "var(--danger-border)" } : undefined}
    >
      <h2
        className="text-[0.9375rem] font-semibold tracking-tight"
        style={danger ? { color: "var(--danger)" } : undefined}
      >
        {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-2">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsForm({
  userId,
  email,
  initialDisplayName,
  status,
  renewsOn,
  hasAccess,
}: {
  userId: string;
  email: string;
  initialDisplayName: string;
  status: string | null;
  renewsOn: string | null;
  hasAccess: boolean;
}) {
  const router = useRouter();
  // The current accent comes from AccentScope in the dashboard layout, which
  // already server-rendered it from the same row — no second source of truth.
  const { accent, setAccent } = useAccent();

  const [name, setName] = useState(initialDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [accentError, setAccentError] = useState<string | null>(null);
  const [savingAccent, setSavingAccent] = useState<AccentValue | null>(null);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (savedTimer.current && clearTimeout(savedTimer.current)), []);

  const trimmed = name.trim();
  const nameDirty = trimmed !== initialDisplayName;

  /** One upsert for both fields — user_id is the primary key, so this is
   *  an insert on first write and a targeted update after. */
  const writeProfile = useCallback(
    async (patch: { display_name?: string; accent?: AccentValue }) => {
      const supabase = createClient();
      return supabase.from("user_profiles").upsert(
        {
          user_id: userId, // always explicit
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    },
    [userId],
  );

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameDirty || savingName) return;

    setSavingName(true);
    setNameError(null);
    setNameSaved(false);

    const { error } = await writeProfile({ display_name: trimmed });
    setSavingName(false);

    if (error) {
      setNameError("We couldn't save your name. Try again in a moment.");
      return;
    }

    setNameSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setNameSaved(false), 2400);
    router.refresh(); // the sidebar greets you by this name
  }

  async function chooseAccent(next: AccentValue) {
    if (next === accent || savingAccent) return;
    const previous = accent;

    setAccent(next); // the whole app re-tints on the press
    setSavingAccent(next);
    setAccentError(null);

    const { error } = await writeProfile({ accent: next });
    setSavingAccent(null);

    if (error) {
      setAccent(previous); // roll back so the UI never lies about what's stored
      setAccentError("We couldn't save that colour. Try again in a moment.");
    }
  }

  async function openBilling() {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (res.ok && data?.url) {
        window.location.href = data.url;
        return; // leave the button busy — the page is on its way out
      }

      setBillingError(
        res.status === 401
          ? "Your session expired. Refresh the page and sign in again."
          : (data?.error ?? "We couldn't open the billing portal. Try again in a moment."),
      );
    } catch {
      setBillingError("Couldn't reach Stripe. Check your connection and try again.");
    }
    setBillingLoading(false);
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const statusInfo = status ? (STATUS[status] ?? { label: status, tone: "warn" as const }) : null;
  const statusColor =
    statusInfo?.tone === "good"
      ? "var(--accent)"
      : statusInfo?.tone === "bad"
        ? "var(--danger)"
        : "var(--muted)";

  return (
    <div className="animate-fade-in mx-auto w-full max-w-2xl p-5 md:p-8">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="title-2 mt-1.5">Settings</h1>
      </div>

      <div className="mt-7 flex flex-col gap-4">
        {/* ---------- Account ---------- */}
        <Section title="Account" description="Who you are on this bundle.">
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="settings-email" className="eyebrow block">
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                readOnly
                disabled
                className="input tnum mt-2 w-full font-mono text-[0.8125rem] opacity-70"
              />
              <p className="mt-1.5 text-xs text-muted-2">
                This is the login the subscription is attached to.
              </p>
            </div>

            <form onSubmit={saveName}>
              <label htmlFor="settings-name" className="eyebrow block">
                Display name
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  maxLength={MAX_NAME}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameSaved(false);
                  }}
                  placeholder="Your name"
                  className="input min-w-0 flex-1"
                />
                <button
                  type="submit"
                  disabled={!nameDirty || savingName}
                  className="btn btn-secondary disabled:opacity-45"
                >
                  {savingName && <Spinner />}
                  {savingName ? "Saving…" : "Save"}
                </button>
              </div>

              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-2">
                {nameSaved ? (
                  <span
                    className="animate-fade-in flex items-center gap-1.5"
                    style={{ color: "var(--accent)" }}
                  >
                    <Glyph name="check" size={13} />
                    Saved
                  </span>
                ) : (
                  "Used to greet you in the sidebar. Nothing public."
                )}
              </p>

              {nameError && (
                <p role="alert" className="alert-danger animate-fade-in mt-2.5">
                  {nameError}
                </p>
              )}
            </form>
          </div>
        </Section>

        {/* ---------- Subscription ---------- */}
        <Section
          title="Subscription"
          description={`All ${TOOLS.length} tools, one bill. Managed by Stripe.`}
        >
          <div className="card p-4" style={{ backgroundColor: "var(--surface-2)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium tracking-tight">The whole bundle</p>
              <p className="tnum font-mono text-sm text-muted">
                ${BUNDLE_PRICE_USD}
                <span className="text-muted-2">/mo</span>
              </p>
            </div>

            <div className="mt-3.5 flex flex-col gap-2 border-t border-dashed border-border pt-3.5 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-2">Status</span>
                <span className="min-w-4 flex-1 border-b border-dashed border-border" />
                <span className="flex items-center gap-1.5" style={{ color: statusColor }}>
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: statusColor }}
                    aria-hidden
                  />
                  {statusInfo?.label ?? "No subscription"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-muted-2">
                  {hasAccess ? "Renews" : status ? "Ends" : "Renews"}
                </span>
                <span className="min-w-4 flex-1 border-b border-dashed border-border" />
                <span className="tnum font-mono text-muted">{renewsOn ?? "—"}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openBilling}
            disabled={billingLoading}
            className="btn btn-secondary mt-4 disabled:opacity-60"
          >
            {billingLoading ? <Spinner /> : <Glyph name="card" size={15} />}
            {billingLoading ? "Opening Stripe…" : "Manage billing"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-muted-2">
            Change your card, download invoices, or cancel — all in Stripe&apos;s portal.
          </p>

          {billingError && (
            <p role="alert" className="alert-danger animate-fade-in mt-3">
              {billingError}
            </p>
          )}
        </Section>

        {/* ---------- Appearance ---------- */}
        <Section
          title="Appearance"
          description="The accent colour used for buttons, focus rings, and highlights across the app."
        >
          <div
            role="radiogroup"
            aria-label="Accent colour"
            className="flex flex-wrap items-start gap-3"
          >
            {ACCENTS.map((option) => {
              const selected = accent === option.value;
              return (
                <div key={option.value} className="flex w-14 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.note ? `${option.label} (${option.note})` : option.label}
                    onClick={() => chooseAccent(option.value)}
                    disabled={savingAccent !== null}
                    data-accent={option.value}
                    className="swatch"
                  >
                    {savingAccent === option.value ? (
                      <Spinner />
                    ) : selected ? (
                      <Glyph name="check" size={15} />
                    ) : null}
                  </button>
                  <span
                    className="text-center text-[0.6875rem] leading-tight"
                    style={{ color: selected ? "var(--foreground)" : "var(--muted-2)" }}
                  >
                    {option.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-2">
            Green is the default. Category colours on the dashboard don&apos;t change — those
            identify the section, not your preference.
          </p>

          {accentError && (
            <p role="alert" className="alert-danger animate-fade-in mt-3">
              {accentError}
            </p>
          )}
        </Section>

        {/* ---------- Danger zone ---------- */}
        <Section
          title="Danger zone"
          description="Ends this session on this device. Your data and subscription are untouched."
          danger
        >
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="btn disabled:opacity-60"
            style={{
              backgroundColor: "var(--danger-soft)",
              border: "1px solid var(--danger-border)",
              color: "var(--danger)",
            }}
          >
            {signingOut ? <Spinner /> : <Glyph name="power" size={15} />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </Section>
      </div>
    </div>
  );
}
