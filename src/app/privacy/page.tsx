import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

const TITLE = "Privacy Policy";
const BLURB =
  "What we collect, who else sees it, and how to get it back or delete it. Short, because we collect very little.";

export const metadata: Metadata = {
  title: TITLE,
  description: BLURB,
  openGraph: { title: `${TITLE} — VibeBundl`, description: BLURB, type: "website" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title={TITLE} updated="5 August 2026" summary={BLURB}>
      <h2>The short version</h2>
      <p>
        We store your email address, whatever you put into the tools, and a subscription
        record. We use no advertising trackers and no third-party analytics cookies —
        there is no consent banner on this site because there is nothing to consent to.
        We do not sell your data, and we never will.
      </p>

      <h2>What we collect</h2>
      <h3>Because you gave it to us</h3>
      <ul>
        <li>
          <strong>Your email address and password.</strong> The password is hashed by
          Supabase Auth; we can&apos;t read it.
        </li>
        <li>
          <strong>An optional display name and accent preference</strong>, if you set them.
        </li>
        <li>
          <strong>Everything you create in the tools</strong> — notes, links, bookmarks,
          invoices, form responses, uploads and so on.
        </li>
        <li>
          <strong>What you send us</strong> if you email, submit a tool request, or apply to
          sponsor.
        </li>
      </ul>

      <h3>Because you used the service</h3>
      <ul>
        <li>
          <strong>Aggregate page analytics</strong> via Vercel Analytics: page path, country,
          browser type, referrer. Cookieless, not tied to your account, and never used to
          build a profile.
        </li>
        <li>
          <strong>Operational logs</strong> from our host — request paths, status codes,
          timestamps and IP addresses — kept briefly so we can debug errors and stop abuse.
        </li>
        <li>
          <strong>Click counts</strong> on links you shorten, and view counts on pages you
          publish. These are your analytics, shown to you.
        </li>
      </ul>

      <h3>What we do not collect</h3>
      <p>
        No advertising identifiers, no cross-site tracking, no session recording, no
        fingerprinting, and <strong>no card details</strong> — payment data goes straight to
        Stripe and never touches our servers.
      </p>

      <h2>Why we&apos;re allowed to</h2>
      <p>
        Under the GDPR our lawful bases are: <strong>performance of a contract</strong> (we
        can&apos;t run your account without your email and your content),{" "}
        <strong>legitimate interests</strong> (keeping the service up, preventing abuse,
        counting page views in aggregate), and <strong>legal obligation</strong> (keeping
        invoices for tax).
      </p>

      <h2>Who else sees it</h2>
      <p>We use a small number of processors, each for one job:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and file storage.
        </li>
        <li>
          <strong>Vercel</strong> — hosting, request logs and cookieless analytics.
        </li>
        <li>
          <strong>Stripe</strong> — payments and billing. They hold your card details, we
          hold a customer ID.
        </li>
        <li>
          <strong>Resend</strong> — transactional email, and newsletters you choose to send.
        </li>
        <li>
          <strong>Anthropic</strong> — only for the AI tools, and only for the text you
          submit to them. If you never open an AI tool, nothing is sent.
        </li>
        <li>
          <strong>Cloudflare</strong> — DNS and email routing for our own inbox.
        </li>
      </ul>
      <p>
        That&apos;s the whole list. We don&apos;t sell data, we don&apos;t share it for
        advertising, and we don&apos;t hand it to anyone else unless we&apos;re legally
        compelled — in which case we&apos;ll tell you if we&apos;re allowed to.
      </p>

      <h2>Where it lives</h2>
      <p>
        Our processors run infrastructure in the EU and the US. Where data moves out of the
        EEA or UK, those transfers rely on the Standard Contractual Clauses in each
        provider&apos;s data processing agreement.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Account and content:</strong> until you delete it, or 30 days after you
          delete your account.
        </li>
        <li>
          <strong>Billing records:</strong> as long as tax law requires, typically several
          years, held by Stripe.
        </li>
        <li>
          <strong>Operational logs:</strong> a short rolling window, then discarded.
        </li>
        <li>
          <strong>Aggregate analytics:</strong> retained as counts, with nothing that
          identifies a person.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask us to show you your data, correct it, delete it, hand it over in a
        portable format, or stop a particular use of it. Most of this you can do yourself
        inside the app — every tool exports, and Settings deletes the account. For anything
        else, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&apos;ll
        answer within 30 days. If you&apos;re in the EEA or UK you also have the right to
        complain to your data protection authority.
      </p>

      <h2>Cookies</h2>
      <p>
        We set one kind of cookie: the session cookie that keeps you signed in. It is
        strictly necessary, so it needs no consent. Your theme choice is stored in your
        browser&apos;s local storage and never sent to us.
      </p>

      <h2>Children</h2>
      <p>
        VibeBundl isn&apos;t for children under 16. We don&apos;t knowingly collect their
        data; if you believe we have, email us and we&apos;ll delete it.
      </p>

      <h2>Public pages</h2>
      <p>
        Several tools publish to a public URL when you ask them to. Anything on one of those
        pages is visible to anyone with the link and may be indexed by search engines. Don&apos;t
        put anything there you wouldn&apos;t put on a billboard.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We&apos;ll update this page as the product changes, and email account holders about
        anything material. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
