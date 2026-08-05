import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibebundl.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind auth or under /api is useful to a crawler, and the
      // per-user public pages (/u, /w, /f …) belong to customers, not to us —
      // they're reachable, just not something we push into the index.
      disallow: ["/dashboard", "/api/", "/auth/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
