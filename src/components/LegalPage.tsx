import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

/**
 * Shared chrome for Terms and Privacy.
 *
 * Both documents are read the same way — scanned for one clause — so both
 * get the same shape: a narrow measure, generous leading, and headings that
 * survive being jumped to from a link. `max-w-2xl` rather than the site's
 * `max-w-5xl` because legal prose at 80 characters a line is unreadable and
 * unreadable terms are, functionally, terms nobody agreed to.
 */
export default function LegalPage({
  title,
  updated,
  summary,
  children,
}: {
  title: string;
  updated: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="animate-fade-in mx-auto w-full max-w-2xl px-4 pt-14 pb-4 md:pt-20">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-3xl tracking-[var(--tracking-display)] md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{summary}</p>
        <p className="mt-4 text-xs text-muted-2">Last updated {updated}</p>
        <div className="rule mt-8" />
      </div>

      <div className="legal mx-auto w-full max-w-2xl px-4 pb-8">{children}</div>

      <SiteFooter />
    </main>
  );
}
