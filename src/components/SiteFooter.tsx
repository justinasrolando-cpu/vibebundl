import Link from "next/link";
import BuiltBy from "@/components/BuiltBy";
import { GITHUB_URL } from "@/lib/site";

/**
 * The marketing footer, shared by every public page. Same reasoning as
 * SiteHeader: one definition, so the disclaimer can't go stale on one page
 * while it's updated on another.
 *
 * Three bands rather than one. Navigation, then the attribution paired with
 * the credit, then the fine print. The attribution sentence keeps its own
 * line on purpose — it's what establishes that we're a tribute and not a
 * clone, and it should never end up compressed into a row of links.
 */
export default function SiteFooter() {
  return (
    <footer className="mx-auto mt-[var(--section-gap)] w-full max-w-5xl px-4 pb-16">
      <div className="rule" />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold tracking-tight">
          vibe<span className="text-accent">bundl</span>
        </span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <Link href="/request" className="transition-colors hover:text-foreground">
            Request a tool
          </Link>
          <Link href="/sponsor" className="transition-colors hover:text-foreground">
            Sponsor
          </Link>
          <Link href="/press" className="transition-colors hover:text-foreground">
            Brand kit
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-2">
          VibeBundl is built from the community verdicts on{" "}
          <a
            href="https://canivibecodeit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            canivibecodeit.com
          </a>
          , an independent project we&apos;re not affiliated with or endorsed by.
        </p>
        <BuiltBy className="shrink-0" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.6875rem] text-muted-2">
        <span className="tnum">© {new Date().getFullYear()} VibeBundl</span>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
