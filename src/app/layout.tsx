import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import ScrollToTop from "@/components/ScrollToTop";
import ThemeScript from "@/components/ThemeScript";
import { BUNDLE_PRICE_USD, TOOL_COUNT_LABEL } from "@/lib/tools";

/* Both halves of the trade in five words, and the same vocabulary as the
   hero. This is the line that shows in a browser tab, in search results, and
   under the card when someone posts the link — it should not be the one
   place still calling them "subscriptions". */
const TITLE = `VibeBundl — ${TOOL_COUNT_LABEL} SaaS bills, one subscription`;
const BLURB = `${TOOL_COUNT_LABEL} small tools behind one login and one $${BUNDLE_PRICE_USD}/mo subscription. Built from the community verdicts on canivibecodeit.com — the SaaS everyone said was one prompt away from free.`;

/**
 * Space Grotesk for voice, JetBrains Mono for data.
 * The variable names stay --font-geist-* so the ~60 files already using
 * font-sans / font-mono keep working without a sweep.
 */
const displaySans = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const dataMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibebundl.com";

export const metadata: Metadata = {
  // Absolute URLs for OG/Twitter cards — without this the share image
  // resolves relative and X renders nothing.
  metadataBase: new URL(SITE),
  title: TITLE,
  description: BLURB,
  openGraph: { title: TITLE, description: BLURB, type: "website" },
  // summary_large_image, not summary: "summary" renders the tiny square
  // thumbnail-beside-text card on X, which crops the 1200x630 share image to
  // an unreadable sliver. The large card is the full-width banner.
  twitter: { card: "summary_large_image", title: TITLE, description: BLURB },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // ThemeScript writes data-theme onto this element before hydration,
      // so React must be told the mismatch is intentional.
      suppressHydrationWarning
      className={`${displaySans.variable} ${dataMono.variable} h-full antialiased dark`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ScrollToTop />
        {children}
        {/* Cookieless and aggregate-only, so it needs no consent banner —
            which is the whole reason we use this and not Google Analytics on
            a site whose pitch includes a privacy-friendly analytics tool. */}
        <Analytics />
      </body>
    </html>
  );
}
