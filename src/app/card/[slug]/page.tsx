import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SaveContactButton from "./SaveContactButton";

type BusinessCard = {
  id: string;
  slug: string;
  full_name: string;
  job_title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
};

/**
 * Row glyphs. Drawn here rather than pulled from ToolIcon (which is keyed by
 * tool slug, not by contact-method) so the three rows stay optically matched:
 * same 24×24 box, same 1.5 stroke, same round joins as the rest of the app.
 */
function RowIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 shrink-0 fill-none stroke-muted stroke-[1.5]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function normalizeWebsite(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export default async function PublicBusinessCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Through the RPC, not the table: business_cards no longer has a public
  // SELECT policy, because a row-level "true" on a table of contact details
  // is indistinguishable from "anyone may dump every customer's phone
  // number". The function takes a slug and returns display columns only —
  // user_id and created_at never reach the client. See migration 0012.
  const { data } = await supabase.rpc("public_business_card", { card_slug: slug });

  const card = (Array.isArray(data) ? data[0] : data) as BusinessCard | undefined;
  if (!card) notFound();

  const fullName = (card.full_name ?? "").trim();
  const jobTitle = (card.job_title ?? "").trim();
  const company = (card.company ?? "").trim();
  const email = (card.email ?? "").trim();
  const phone = (card.phone ?? "").trim();
  const website = normalizeWebsite(card.website ?? "");
  const websiteLabel = website.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const rowClass =
    "flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover active:scale-[0.99]";

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-10 sm:py-16">
      <div className="animate-fade-in flex w-full max-w-sm flex-col">
        <div className="card overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-accent/30 via-accent/10 to-transparent" />

          <div className="-mt-10 flex flex-col items-center px-5 pb-7 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface text-2xl font-semibold text-accent shadow-lg shadow-black/40">
              {initialsOf(fullName || card.slug)}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              {fullName || card.slug}
            </h1>

            {jobTitle && <p className="mt-1 text-sm text-foreground/80">{jobTitle}</p>}
            {company && <p className="mt-0.5 text-sm text-muted">{company}</p>}

            {(email || phone || website) && (
              <div className="mt-6 flex w-full flex-col gap-2">
                {email && (
                  <a href={`mailto:${email}`} className={rowClass}>
                    <RowIcon>
                      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                      <path d="M3.5 7.5 12 13l8.5-5.5" />
                    </RowIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wide text-muted">
                        Email
                      </span>
                      <span className="block truncate text-sm">{email}</span>
                    </span>
                  </a>
                )}

                {phone && (
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={rowClass}>
                    <RowIcon>
                      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                      <path d="M10.5 18.5h3" />
                    </RowIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wide text-muted">
                        Phone
                      </span>
                      <span className="block truncate text-sm">{phone}</span>
                    </span>
                  </a>
                )}

                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={rowClass}
                  >
                    <RowIcon>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3.5 9.5h17" />
                      <path d="M3.5 14.5h17" />
                      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
                    </RowIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wide text-muted">
                        Website
                      </span>
                      <span className="block truncate text-sm">{websiteLabel}</span>
                    </span>
                  </a>
                )}
              </div>
            )}

            <div className="mt-6 w-full">
              <SaveContactButton
                contact={{
                  slug: card.slug,
                  fullName,
                  jobTitle,
                  company,
                  email,
                  phone,
                  website,
                }}
              />
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted">
          Made with <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
