import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ToolIcon from "@/components/ToolIcon";
import { tradeoffFor } from "@/lib/tradeoffs";
import {
  BUNDLE_PRICE_USD,
  TOOLS,
  TOOLS_BY_SLUG,
  categoryKey,
} from "@/lib/tools";

/**
 * One page per tool, in the question format the reference site uses.
 *
 * Two reasons this exists rather than being a section on the landing page.
 *
 * The commercial one: "Calendly alternative" and "how much does Bitly cost"
 * are 53 separate long-tail searches, and a page that answers exactly one of
 * them ranks in a way a combined page never will.
 *
 * The honest one: the answer to "what do I lose?" belongs next to the thing
 * you'd lose it from. Burying every gap in one long comparison table lets a
 * reader skim past the one that would have changed their mind — which is
 * precisely the outcome the table is supposed to prevent.
 *
 * Statically generated for all 53, because the content is a pure function of
 * two data files and nothing here needs a request.
 */
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOLS_BY_SLUG.get(slug);
  if (!tool) return {};

  const title = `${tool.replaces} alternative — ${tool.name} in VibeBundl`;
  const description = `${tool.replaces} costs about $${tool.originalPrice}/mo. ${tool.description} Included in VibeBundl at $${BUNDLE_PRICE_USD}/mo with ${TOOLS.length - 1} other tools — and here's exactly what you'd give up.`;

  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-0.5 size-4 shrink-0 fill-none stroke-[var(--cat)] stroke-[2.4]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-0.5 size-4 shrink-0 fill-none stroke-muted-2 stroke-[2.2]"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function Answer({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <h2 className="text-base tracking-tight">{question}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = TOOLS_BY_SLUG.get(slug);
  if (!tool) notFound();

  const t = tradeoffFor(slug);
  const yearly = Math.round(tool.originalPrice * 12);
  const others = TOOLS.length - 1;

  /* Three neighbours from the same category — a reader who came here for one
     tool is usually shopping for the job, not the product. */
  const related = TOOLS.filter((x) => x.category === tool.category && x.slug !== slug).slice(0, 3);

  return (
    <main className="flex min-h-screen flex-col" data-cat={categoryKey(tool.category)}>
      <SiteHeader />

      <article className="animate-fade-in mx-auto w-full max-w-2xl px-4 pt-14 pb-4 md:pt-20">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-[color-mix(in_oklab,var(--cat)_10%,transparent)]">
            <ToolIcon slug={tool.slug} className="size-5 text-foreground" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">{tool.category}</p>
            <p className="mt-1 truncate text-sm text-muted">{tool.name}</p>
          </div>
        </div>

        <h1 className="mt-6 text-3xl tracking-[var(--tracking-display)] md:text-4xl">
          A smaller {tool.replaces}, for people who don&apos;t need {tool.replaces}.
        </h1>

        {/* The old headline was "Can I stop paying for X?" — a question this page
            then had to answer "yes, probably". The first outside reader tested it
            against the one product he actually paid for and it lost, correctly.
            Anyone who depends on the original will always find ours thinner, so
            the page now disqualifies them in the first sentence instead of
            selling to them and being found out in the second. */}
        <p className="mt-4 text-sm leading-relaxed text-muted">
          <strong className="text-foreground">
            If {tool.replaces} is load-bearing for you, don&apos;t switch.
          </strong>{" "}
          You&apos;ll find this thinner and you&apos;ll be right. {tool.description} It comes
          with {others} other tools for ${BUNDLE_PRICE_USD}/mo — which is the argument, not
          that it beats a product with a team behind it.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card p-3">
            <p className="eyebrow">{tool.replaces}</p>
            <p className="tnum mt-1.5 text-lg tracking-tight">${tool.originalPrice}/mo</p>
          </div>
          <div className="card p-3">
            <p className="eyebrow">Per year</p>
            <p className="tnum mt-1.5 text-lg tracking-tight">${yearly}</p>
          </div>
          <div className="card p-3">
            <p className="eyebrow">In the bundle</p>
            <p className="tnum mt-1.5 text-lg tracking-tight">${BUNDLE_PRICE_USD}/mo</p>
          </div>
        </div>

        <div className="rule mt-10" />

        <div className="mt-8">
          <Answer question={`How much does ${tool.replaces} cost?`}>
            <p>
              About{" "}
              <strong className="text-foreground">${tool.originalPrice} a month</strong>, which
              is <strong className="text-foreground">${yearly} a year</strong>, on the plan most
              individuals end up on. It is what we use in our own arithmetic — the list-price
              figure on the front page is the sum of these, not a round number we liked.
            </p>
          </Answer>

          {t && (
            <Answer question="What do you actually get in VibeBundl?">
              <ul className="flex flex-col gap-2">
                {t.keeps.map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <Check />
                    <span className="text-foreground">{k}</span>
                  </li>
                ))}
              </ul>
            </Answer>
          )}

          {t && (
            <Answer question={`What do I lose by replacing ${tool.replaces}?`}>
              <p>
                Honestly, these. If any of them is load-bearing for you, keep paying — a
                bundle that costs you a workflow isn&apos;t a saving.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {t.loses.map((l) => (
                  <li key={l} className="flex gap-2.5">
                    <Cross />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Answer>
          )}

          <Answer question={`Is there an open-source alternative to ${tool.replaces}?`}>
            {t?.openSource ? (
              <p>
                Yes — <strong className="text-foreground">{t.openSource}</strong>. If you&apos;re
                happy running and updating your own server, it will take you further than our
                version will, and it&apos;s free. VibeBundl&apos;s argument isn&apos;t that
                it&apos;s more capable than {t.openSource}; it&apos;s that it&apos;s already
                running, and so are {others} other tools, on one login.
              </p>
            ) : (
              <p>
                Not one we&apos;d send you to. There are half-finished projects in this space,
                but nothing we&apos;d call a working replacement — which is part of why we
                built it.
              </p>
            )}
          </Answer>

          <Answer question="What's the catch?">
            <p>
              It&apos;s smaller. {TOOLS.length} tools built by one person do not match{" "}
              {TOOLS.length} funded products, and we&apos;re not going to pretend otherwise.
              Each one covers the job you opened the original for and stops there.
            </p>
            <p className="mt-3">
              So the honest pitch isn&apos;t &ldquo;cancel {tool.replaces}&rdquo;. It&apos;s
              that the next time you need something like it — once, briefly — you already
              have it, and you don&apos;t start another subscription to find out.
            </p>
          </Answer>
        </div>

        <div className="card-raised mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm tracking-tight">
              {tool.name} plus {others} more, ${BUNDLE_PRICE_USD}/mo
            </p>
            <p className="mt-1 text-xs text-muted-2">
              Cancel any time. Keep {tool.replaces} if you need it.
            </p>
          </div>
          <Link href="/login?checkout=1" className="btn btn-primary btn-lg shrink-0">
            get the bundle
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm tracking-tight">Also in {tool.category}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/tools/${r.slug}`}
                  className="card breathe flex items-center gap-3 p-3 transition-colors hover:bg-surface-hover"
                >
                  <ToolIcon slug={r.slug} className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.name}{" "}
                    <span className="text-muted-2">— replaces {r.replaces}</span>
                  </span>
                  <span className="tnum shrink-0 text-xs text-muted-2">
                    ${r.originalPrice}/mo
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <SiteFooter />
    </main>
  );
}
