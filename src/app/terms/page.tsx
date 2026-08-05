import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { BUNDLE_PRICE_USD, TOOL_COUNT_LABEL } from "@/lib/tools";
import { CONTACT_EMAIL, JURISDICTION, JURISDICTION_CITY } from "@/lib/site";

const TITLE = "Terms of Service";
const BLURB =
  "What you get, what it costs, how to leave, and what we don't promise. Written to be read once and understood.";

export const metadata: Metadata = {
  title: TITLE,
  description: BLURB,
  openGraph: { title: `${TITLE} — VibeBundl`, description: BLURB, type: "website" },
};

export default function TermsPage() {
  return (
    <LegalPage title={TITLE} updated="5 August 2026" summary={BLURB}>
      <h2>The short version</h2>
      <p>
        You pay <strong>${BUNDLE_PRICE_USD} per month</strong> for access to every tool in
        the bundle. You can cancel at any time from Settings and keep access until the end
        of the period you already paid for. If a tool loses your data because we broke
        something, tell us and we&apos;ll fix it — but export anything you can&apos;t afford
        to lose, because we&apos;re a small product and you should treat us like one.
      </p>
      <p>
        Everything below says the same things more carefully. Where the two disagree, the
        careful version wins.
      </p>

      <h2>1. Who we are</h2>
      <p>
        VibeBundl (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a subscription bundle of{" "}
        {TOOL_COUNT_LABEL} small web tools operated from vibebundl.com. Reach us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p>
        We are not affiliated with, endorsed by, or connected to canivibecodeit.com, or to
        any of the products our tools are described as replacing. Those names are used to
        describe what a tool does. All trademarks belong to their owners.
      </p>

      <h2>2. Your account</h2>
      <p>
        You need an account to use the tools. You are responsible for what happens under
        it, including keeping your password to yourself. One account is for one person or
        one business — don&apos;t resell access or share a login across an organisation.
      </p>
      <p>
        You must be old enough to enter a contract where you live. If you&apos;re using
        VibeBundl for a company, you&apos;re confirming you can agree to this on its behalf.
      </p>

      <h2>3. Subscription, billing and cancellation</h2>
      <ul>
        <li>
          The subscription is <strong>${BUNDLE_PRICE_USD} per month</strong>, charged in
          advance, and renews automatically until you cancel.
        </li>
        <li>
          Payments are processed by <strong>Stripe</strong>. We never see or store your
          card number.
        </li>
        <li>
          Cancel any time from <strong>Settings → Manage billing</strong>. Cancelling stops
          the next charge; it does not refund the current period, and you keep access until
          that period ends.
        </li>
        <li>
          If a payment fails, Stripe retries. If it keeps failing, access pauses until the
          card is fixed — your data stays where it is.
        </li>
        <li>
          If we change the price, we&apos;ll email you at least 30 days before it applies to
          you, and you can cancel before it does.
        </li>
      </ul>

      <h3>Refunds</h3>
      <p>
        If something is broken, or the product isn&apos;t what you thought it was, email us
        within <strong>14 days</strong> of a charge and we&apos;ll refund it — no argument
        and no form to fill in. After 14 days we&apos;ll look at it case by case. If you
        have a statutory right to a refund where you live, this paragraph doesn&apos;t
        reduce it.
      </p>
      <p>
        Please email us before opening a chargeback. A dispute costs us a fixed fee on top
        of the refund, and there is nothing a bank can do here that we won&apos;t do faster.
      </p>

      <h2>4. What the tools are, and what they are not</h2>
      <p>
        Each tool covers the core job of the product it replaces. They are deliberately
        <strong> not feature-parity</strong> with those products, and we don&apos;t claim
        they are. Before you cancel a subscription you depend on, read what the tool says it
        does and check that the part you actually use is there.
      </p>
      <p>
        We add tools, change tools and occasionally retire one that isn&apos;t working. If
        we retire a tool you have data in, we&apos;ll tell you first and give you a way to
        export it.
      </p>

      <h2>5. Your content</h2>
      <p>
        Everything you put into the tools — notes, links, invoices, forms, whatever — stays
        yours. We claim no ownership. We store and process it only to run the product for
        you, and to the extent we&apos;re legally required to.
      </p>
      <p>
        Some tools publish to a public URL when you ask them to (a link-in-bio page, a
        booking page, a blog post, a business card). What you publish is public. That&apos;s
        the feature; treat it as one.
      </p>

      <h2>6. Acceptable use</h2>
      <p>Don&apos;t use VibeBundl to:</p>
      <ul>
        <li>send unsolicited bulk email, or anything a reasonable person would call spam;</li>
        <li>host malware, phishing pages, or content that impersonates someone else;</li>
        <li>
          publish material that is illegal where you or your readers are, or that infringes
          someone else&apos;s rights;
        </li>
        <li>
          hammer our infrastructure — automated abuse, scraping the shared services, or
          using the AI tools to resell inference;
        </li>
        <li>attempt to reach data belonging to another account.</li>
      </ul>
      <p>
        We can suspend or close an account that does these things. Where we reasonably can,
        we&apos;ll warn you first and give you your data.
      </p>

      <h2>7. Availability</h2>
      <p>
        We do not offer an uptime guarantee or an SLA. We aim for the service to be up and
        we&apos;ll say so publicly when it isn&apos;t, but at ${BUNDLE_PRICE_USD} a month
        for {TOOL_COUNT_LABEL} tools it would be dishonest to promise nines we haven&apos;t
        earned yet.
      </p>

      <h2>8. Warranties and liability</h2>
      <p>
        The service is provided <strong>&ldquo;as is&rdquo;</strong>. To the extent the law
        allows, we disclaim implied warranties of merchantability, fitness for a particular
        purpose and non-infringement.
      </p>
      <p>
        To the extent the law allows, our total liability to you for any claim relating to
        VibeBundl is capped at <strong>the amount you paid us in the 12 months before the
        claim</strong>, and we are not liable for indirect or consequential loss — lost
        profits, lost business, or lost data beyond restoring what we hold.
      </p>
      <p>
        Nothing here excludes liability that cannot legally be excluded, including for
        fraud or for death or personal injury caused by negligence. If you&apos;re a
        consumer, your statutory rights are unaffected.
      </p>

      <h2>9. Ending it</h2>
      <p>
        You can cancel and delete your account whenever you want. We can end this agreement
        with 30 days&apos; notice — and if we do, we&apos;ll refund the unused part of what
        you&apos;ve paid — or immediately if you materially breach section 6.
      </p>

      <h2>10. Changes</h2>
      <p>
        We&apos;ll update these terms as the product changes. For anything material, we&apos;ll
        email account holders before it takes effect. Continuing to use VibeBundl after a
        change means you accept it; if you don&apos;t, cancel.
      </p>

      <h2>11. Law</h2>
      <p>
        These terms are governed by the laws of {JURISDICTION}, and the courts of{" "}
        {JURISDICTION_CITY} have jurisdiction — except that if you&apos;re a consumer, you
        keep the right to bring a claim in your own country&apos;s courts under its own law.
      </p>
      <p>
        Any period we quote — the 14-day refund window, the 30 days&apos; notice — runs on{" "}
        {JURISDICTION_CITY} time (CET/CEST).
      </p>

      <h2>12. Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
