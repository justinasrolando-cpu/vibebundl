import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibebundl.com";

/**
 * Generated from the catalogue, not hand-listed.
 *
 * The 53 tool pages are the whole SEO surface — each answers a different
 * "X alternative" query — and a hand-maintained sitemap would have shipped
 * with the first twenty and quietly stopped. Deriving it means a new entry
 * in tools.ts is a new indexed page with no second edit to remember.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const marketing: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/request`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE}/sponsor`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE}/press`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const tools: MetadataRoute.Sitemap = TOOLS.map((t) => ({
    url: `${SITE}/tools/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...marketing, ...tools];
}
