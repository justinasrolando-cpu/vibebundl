import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BLOCKED_TARGET_MESSAGE, safeFetch } from "@/lib/safe-fetch";

type Severity = "error" | "warning" | "info";

type Issue = {
  severity: Severity;
  message: string;
};

const SEVERITY_PENALTY: Record<Severity, number> = {
  error: 15,
  warning: 8,
  info: 3,
};

function isValidHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

type AuditResult = {
  score: number;
  issues: Issue[];
  title: string | null;
  hasMetaDescription: boolean;
  h1Count: number;
  imagesMissingAlt: number;
  linkCount: number;
};

function auditHtml(html: string): AuditResult {
  const issues: Issue[] = [];

  // <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? decodeEntities(stripTags(titleMatch[1])) : "";
  if (!titleMatch || !titleText) {
    issues.push({ severity: "error", message: "Missing <title> tag." });
  } else if (titleText.length < 10) {
    issues.push({ severity: "warning", message: `Title is very short (${titleText.length} chars). Aim for 50-60.` });
  } else if (titleText.length > 60) {
    issues.push({
      severity: "warning",
      message: `Title is long (${titleText.length} chars) and may be truncated in search results. Aim for 50-60.`,
    });
  }

  // meta description
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  let descContent = "";
  if (metaDescMatch) {
    const contentMatch = metaDescMatch[0].match(/content=["']([\s\S]*?)["']/i);
    descContent = contentMatch ? decodeEntities(contentMatch[1]) : "";
  }
  const hasMetaDescription = Boolean(metaDescMatch && descContent);
  if (!hasMetaDescription) {
    issues.push({ severity: "warning", message: "Missing meta description tag." });
  } else if (descContent.length < 50) {
    issues.push({
      severity: "warning",
      message: `Meta description is short (${descContent.length} chars). Aim for 120-160.`,
    });
  } else if (descContent.length > 160) {
    issues.push({
      severity: "warning",
      message: `Meta description is long (${descContent.length} chars) and may be truncated. Aim for 120-160.`,
    });
  }

  // h1 count
  const h1Matches = html.match(/<h1[\s>]/gi) ?? [];
  const h1Count = h1Matches.length;
  if (h1Count === 0) {
    issues.push({ severity: "warning", message: "No <h1> tag found on the page." });
  } else if (h1Count > 1) {
    issues.push({ severity: "warning", message: `Multiple <h1> tags found (${h1Count}). Use a single H1 per page.` });
  }

  // meta viewport
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
  if (!hasViewport) {
    issues.push({ severity: "warning", message: "Missing meta viewport tag (needed for mobile responsiveness)." });
  }

  // images missing alt
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgTags.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  if (imagesMissingAlt > 0) {
    issues.push({
      severity: "info",
      message: `${imagesMissingAlt} of ${imgTags.length} <img> tag(s) are missing an alt attribute.`,
    });
  }

  // links
  const linkMatches = html.match(/<a\b[^>]*\bhref\s*=/gi) ?? [];
  const linkCount = linkMatches.length;

  let score = 100;
  for (const issue of issues) {
    score -= SEVERITY_PENALTY[issue.severity];
  }
  score = Math.max(0, Math.min(100, score));

  if (issues.length === 0) {
    issues.push({ severity: "info", message: "No issues found. Nice work!" });
  }

  return {
    score,
    issues,
    title: titleText || null,
    hasMetaDescription,
    h1Count,
    imagesMissingAlt,
    linkCount,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  const parsedUrl = isValidHttpUrl(rawUrl);
  if (!parsedUrl) {
    return NextResponse.json({ error: "Provide a well-formed http:// or https:// URL." }, { status: 400 });
  }

  let html: string;
  try {
    const res = await safeFetch(parsedUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOCheckerBot/1.0)",
      },
    });
    // safeFetch does not follow redirects (that is how the redirect-to-internal-address
    // bypass is prevented), so surface a 3xx as an audit result instead of crashing.
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        {
          error: `That URL responded with a redirect (${res.status}). For security we do not follow redirects — please submit the final destination URL directly.`,
        },
        { status: 400 },
      );
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed with status ${res.status}.` }, { status: 400 });
    }
    html = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch URL.";
    if (message === BLOCKED_TARGET_MESSAGE) {
      return NextResponse.json(
        { error: "That URL points to a private, local, or otherwise non-public address and cannot be audited." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: `Could not fetch URL: ${message}` }, { status: 400 });
  }

  try {
    const result = auditHtml(html);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
