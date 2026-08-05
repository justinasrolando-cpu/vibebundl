import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { TOOL_COUNT_LABEL } from "@/lib/tools";

/**
 * The marketing header, shared by every public page.
 *
 * `landing` keeps the in-page anchors as anchors; everywhere else they point
 * back at the landing page's sections. One nav definition rather than a copy
 * per page, so a new link can never exist on three pages and not the fourth.
 */
export default function SiteHeader({ variant = "page" }: { variant?: "landing" | "page" }) {
  const home = variant === "landing" ? "" : "/";

  return (
    <header className="chrome sticky top-0 z-30 border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <a href={`${home}#tools`} className="btn btn-ghost hidden text-xs sm:inline-flex">
            all {TOOL_COUNT_LABEL} tools
          </a>
          <a href={`${home}#pricing`} className="btn btn-ghost hidden text-xs sm:inline-flex">
            pricing
          </a>
          {/* md and up only: five links is already the most this bar can hold
              before the logo starts fighting for room. */}
          <Link href="/sponsor" className="btn btn-ghost hidden text-xs md:inline-flex">
            sponsor
          </Link>
          <Link href="/request" className="btn btn-ghost text-xs">
            request a tool
          </Link>
          <ThemeToggle className="ml-1" />
          <Link href="/login" className="btn btn-secondary ml-1 text-xs">
            sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
