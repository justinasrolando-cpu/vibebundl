import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BLOCKED_TARGET_MESSAGE, safeFetch } from "@/lib/safe-fetch";

/**
 * Fetches a page and returns its title, so saving a bookmark does not require
 * typing one by hand. Best-effort: any failure returns `{ title: "" }` with a
 * 200 so the caller can just save the bookmark untitled.
 */

const MAX_BYTES = 512 * 1024; // titles live in <head>; never read a whole page
const MAX_TITLE_LENGTH = 200;

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // &amp; last so "&amp;lt;" does not collapse to "<" in one pass.
    .replace(/&amp;/g, "&");
}

function attrValue(tagMarkup: string, attr: string): string | null {
  const match = tagMarkup.match(new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return match[2] ?? match[3] ?? null;
}

function extractTitle(html: string): string {
  // Prefer og:title / twitter:title, then <title>.
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const wanted of ["og:title", "twitter:title"]) {
    for (const tag of metaTags) {
      const key = (attrValue(tag, "property") ?? attrValue(tag, "name") ?? "").toLowerCase();
      if (key !== wanted) continue;
      const content = attrValue(tag, "content");
      if (content && content.trim()) return content;
    }
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? title[1] : "";
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

  const raw = (body.url ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Provide a well-formed URL." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http:// and https:// URLs are supported." }, { status: 400 });
  }

  try {
    const res = await safeFetch(parsed.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; BookmarksBot/1.0)",
      },
    });
    // safeFetch never follows redirects (that is how redirect-to-internal-address
    // bypasses are prevented), so a 3xx simply means "no title available".
    if (!res.ok) return NextResponse.json({ title: "" });

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/html|xml/i.test(contentType)) {
      return NextResponse.json({ title: "" });
    }

    const buffer = await res.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, MAX_BYTES));

    const title = decodeEntities(extractTitle(html)).replace(/\s+/g, " ").trim();
    return NextResponse.json({ title: title.slice(0, MAX_TITLE_LENGTH) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === BLOCKED_TARGET_MESSAGE) {
      return NextResponse.json(
        { error: "That URL points to a private or local address and cannot be fetched." },
        { status: 400 },
      );
    }
    // Unreachable site, timeout, TLS error — not worth blocking the save.
    return NextResponse.json({ title: "" });
  }
}
