"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type BusinessCard = {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  job_title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  created_at: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWebsite(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function BusinessCardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [card, setCard] = useState<BusinessCard | null>(null);

  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);
  const [qrFailure, setQrFailure] = useState<{ url: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Safe to read during render: the first client render still shows the loading
  // state, so it matches what the server produced.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      if (!authUser) {
        setLoading(false);
        return;
      }
      setUser(authUser);

      // limit(1) rather than maybeSingle(): maybeSingle() throws outright if a
      // second card row ever exists, which would blank the whole editor.
      const { data: rows, error: fetchError } = await supabase
        .from("business_cards")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const data = rows?.[0];
      if (fetchError) {
        setError("Couldn't load your card. Refresh the page to try again.");
      } else if (data) {
        const row = data as BusinessCard;
        setCard(row);
        setSlug(row.slug);
        setSlugTouched(true);
        setFullName(row.full_name ?? "");
        setJobTitle(row.job_title ?? "");
        setCompany(row.company ?? "");
        setEmail(row.email ?? "");
        setPhone(row.phone ?? "");
        setWebsite(row.website ?? "");
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Auto-suggest the slug from the name until the user edits it themselves.
  function handleFullNameChange(value: string) {
    setFullName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  const savedSlug = card?.slug ?? null;
  const publicPath = savedSlug ? `/card/${savedSlug}` : null;
  const publicUrl = publicPath ? `${origin}${publicPath}` : null;

  // Render the QR for the *saved* URL — an unsaved slug wouldn't resolve.
  useEffect(() => {
    if (!publicUrl) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      width: 512,
      margin: 1,
      color: { dark: "#09090b", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr({ url: publicUrl, dataUrl });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setQrFailure({
          url: publicUrl,
          message: e instanceof Error ? e.message : "Could not generate the QR code.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const qrDataUrl = publicUrl && qr && qr.url === publicUrl ? qr.dataUrl : null;
  const qrError =
    publicUrl && qrFailure && qrFailure.url === publicUrl ? qrFailure.message : null;

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setError(null);
      setSavedAt(null);

      const cleanSlug = slugify(slug);
      if (!cleanSlug) {
        setError("Pick a URL slug — letters, numbers and dashes only.");
        return;
      }
      if (!fullName.trim()) {
        setError("Add your full name so the card has something to show.");
        return;
      }

      const payload = {
        slug: cleanSlug,
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        website: normalizeWebsite(website),
      };

      setSaving(true);
      try {
        if (card) {
          const { data, error: updateError } = await supabase
            .from("business_cards")
            .update(payload)
            .eq("id", card.id)
            .eq("user_id", user.id)
            .select()
            .single();

          if (updateError) {
            setError(
              updateError.code === "23505"
                ? `The slug "${cleanSlug}" is already taken. Try another one.`
                : updateError.message,
            );
            return;
          }
          setCard(data as BusinessCard);
        } else {
          const { data, error: insertError } = await supabase
            .from("business_cards")
            .insert({ user_id: user.id, ...payload })
            .select()
            .single();

          if (insertError) {
            setError(
              insertError.code === "23505"
                ? `The slug "${cleanSlug}" is already taken. Try another one.`
                : insertError.message,
            );
            return;
          }
          setCard(data as BusinessCard);
        }
        setSlug(cleanSlug);
        setWebsite(payload.website);
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    },
    [supabase, user, card, slug, fullName, jobTitle, company, email, phone, website],
  );

  async function copyPublicUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to the clipboard — select the URL and copy it manually.");
    }
  }

  const previewWebsite = normalizeWebsite(website);
  const previewHost = previewWebsite.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 md:p-8">
      <h1 className="text-lg font-semibold">Business Card</h1>
      <p className="mt-1 text-sm text-muted">
        A digital business card with its own public page and a scannable QR code.
      </p>

      <div className="mt-6 grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form */}
        <form onSubmit={handleSave} className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-medium">Card details</h2>

          <div>
            <label className="text-xs text-muted" htmlFor="card-name">
              Full name
            </label>
            <input
              id="card-name"
              className="input mt-1 w-full"
              value={fullName}
              onChange={(e) => handleFullNameChange(e.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted" htmlFor="card-title">
                Job title
              </label>
              <input
                id="card-title"
                className="input mt-1 w-full"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Founder"
              />
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor="card-company">
                Company
              </label>
              <input
                id="card-company"
                className="input mt-1 w-full"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Analytical Engines Ltd"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted" htmlFor="card-email">
                Email
              </label>
              <input
                id="card-email"
                type="email"
                className="input mt-1 w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor="card-phone">
                Phone
              </label>
              <input
                id="card-phone"
                type="tel"
                className="input mt-1 w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 010 1234"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="card-website">
              Website
            </label>
            <input
              id="card-website"
              className="input mt-1 w-full"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
            />
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="card-slug">
              Public URL slug
            </label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-muted">/card/</span>
              <input
                id="card-slug"
                className="input flex-1"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="ada-lovelace"
                required
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Letters, numbers and dashes. Suggested from your name until you change it.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary self-start" disabled={saving}>
              {saving ? "Saving…" : card ? "Save changes" : "Create card"}
            </button>
            {savedAt && !saving && <span className="text-xs text-accent">Saved</span>}
          </div>
        </form>

        {/* Live preview */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted">Live preview</span>
          <div className="card overflow-hidden">
            <div className="h-16 bg-gradient-to-br from-accent/25 via-accent/5 to-transparent" />
            <div className="-mt-8 flex flex-col items-center px-5 pb-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-accent">
                {initialsOf(fullName)}
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                {fullName.trim() || "Your name"}
              </h3>
              {(jobTitle.trim() || company.trim()) && (
                <p className="mt-1 text-sm text-muted">
                  {[jobTitle.trim(), company.trim()].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-5 flex w-full flex-col gap-2">
                {email.trim() && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-left">
                    <p className="text-[10px] uppercase tracking-wide text-muted">Email</p>
                    <p className="truncate text-sm">{email.trim()}</p>
                  </div>
                )}
                {phone.trim() && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-left">
                    <p className="text-[10px] uppercase tracking-wide text-muted">Phone</p>
                    <p className="truncate text-sm">{phone.trim()}</p>
                  </div>
                )}
                {previewHost && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-left">
                    <p className="text-[10px] uppercase tracking-wide text-muted">Website</p>
                    <p className="truncate text-sm">{previewHost}</p>
                  </div>
                )}
                {!email.trim() && !phone.trim() && !previewHost && (
                  <p className="text-xs text-muted">
                    Add an email, phone or website and they&apos;ll appear as tappable rows here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share */}
      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-medium">Share</h2>

        {!card ? (
          <p className="mt-2 text-sm text-muted">
            Save your card first — then you&apos;ll get a public link and a QR code to share.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="card flex flex-col gap-3 p-4">
              <div>
                <p className="text-xs text-muted">Public URL</p>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                  <span className="flex-1 truncate text-xs text-muted">
                    {publicUrl ?? publicPath}
                  </span>
                  <button type="button" className="btn btn-secondary text-xs" onClick={copyPublicUrl}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <a
                    href={publicPath ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary text-xs"
                  >
                    View
                  </a>
                </div>
              </div>
              <p className="text-xs text-muted">
                Print the QR on a badge or a physical card — scanning it opens this page.
              </p>
            </div>

            <div className="card flex flex-col items-center gap-3 p-4">
              {qrError ? (
                <p className="text-sm text-danger">{qrError}</p>
              ) : qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${publicUrl ?? "your card"}`}
                    className="h-40 w-40 rounded-lg bg-white p-2"
                  />
                  <a
                    className="btn btn-secondary text-xs"
                    href={qrDataUrl}
                    download={`${card.slug}-card-qr.png`}
                  >
                    Download PNG
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted">Generating QR code…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
