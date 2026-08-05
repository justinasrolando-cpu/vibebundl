import type { Metadata } from "next";
import RequestBoard from "@/components/RequestBoard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SponsorRail from "@/components/SponsorRail";
import { TOOL_COUNT_LABEL } from "@/lib/tools";

const TITLE = "Request a tool — VibeBundl";
const BLURB =
  "Name the subscription you're still paying for. The board is public, the votes decide the order, and everything that ships is included in the bundle at no extra charge.";

export const metadata: Metadata = {
  title: TITLE,
  description: BLURB,
  openGraph: { title: TITLE, description: BLURB, type: "website" },
  twitter: { card: "summary", title: TITLE, description: BLURB },
};

export default function RequestPage() {
  return (
    <main className="flex-1">
      <SiteHeader />

      <div className="relative isolate overflow-hidden">
        <div className="aura" aria-hidden />
        <div className="grid-lines" aria-hidden />

        <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-[var(--section-gap)] md:pt-20">
          <p className="animate-fade-in chip font-mono">
            <span className="text-accent">$</span>
            <span>the roadmap is a public board</span>
          </p>

          <h1 className="animate-fade-in display mt-6 max-w-2xl">
            You pick what we build next.
          </h1>

          <p
            className="animate-fade-in lede mt-6 max-w-md"
            style={{ animationDelay: "40ms" }}
          >
            {TOOL_COUNT_LABEL} tools in, and the list only grows one way: someone names the
            subscription they resent paying for, enough people agree, and it turns up in your
            bundle. Same price.
          </p>

          <RequestBoard />
        </section>
      </div>

      <SponsorRail />

      <SiteFooter />
    </main>
  );
}
