import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BLOCKED_TARGET_MESSAGE, safeFetch } from "@/lib/safe-fetch";

const MAX_ITEMS = 50;
const SUMMARY_LENGTH = 300;

export type FeedItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
};

export type FeedResult = {
  title: string;
  items: FeedItem[];
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

/** Replace <![CDATA[ ... ]]> wrappers with their raw contents. */
function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // &amp; last so that "&amp;lt;" does not become "<" in a single pass.
    .replace(/&amp;/g, "&");
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Plain text out of an XML node body: CDATA -> entities -> no markup. */
function toPlainText(raw: string): string {
  return collapseWhitespace(decodeEntities(stripTags(decodeEntities(unwrapCdata(raw)))));
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * First body of `<tag>…</tag>`, ignoring namespace prefixes ("dc:date").
 * Returns null when the tag is absent or self-closing with no body.
 */
function tagBody(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9_-]+:)?${tag}>`, "i");
  const match = xml.match(re);
  return match ? match[1] : null;
}

function attrValue(tagMarkup: string, attr: string): string | null {
  const match = tagMarkup.match(new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return match[2] ?? match[3] ?? null;
}

/** Atom entries carry the URL on <link href="…"> — prefer rel="alternate". */
function atomLink(entryXml: string): string | null {
  const linkTags = entryXml.match(/<(?:[a-z0-9_-]+:)?link\b[^>]*>/gi) ?? [];
  let fallback: string | null = null;
  for (const tag of linkTags) {
    const href = attrValue(tag, "href");
    if (!href) continue;
    const rel = attrValue(tag, "rel");
    if (!rel || rel.toLowerCase() === "alternate") return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

function toIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const text = toPlainText(raw);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Feed-level <title>, taken from the document with all entries removed. */
function parseFeedTitle(xmlWithoutItems: string): string {
  const channel = tagBody(xmlWithoutItems, "channel") ?? xmlWithoutItems;
  const title = tagBody(channel, "title");
  return title ? toPlainText(title) : "";
}

/** Marks the document as an actual feed rather than an HTML page. */
const FEED_ROOT_RE = /<(?:[a-z0-9_-]+:)?(rss|feed|rdf)\b/i;

class FeedParseError extends Error {}

function parseFeed(xml: string, baseUrl: string): FeedResult {
  // Strip the XML declaration and comments so they cannot match tag lookups.
  const doc = xml.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");

  const blockRe = /<(?:[a-z0-9_-]+:)?(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?\1>/gi;
  const blocks = Array.from(doc.matchAll(blockRe));

  // A blog homepage is the single most common thing people paste here. It has a
  // <title>, so without this check it would subscribe "successfully" and then
  // show an empty, apparently-broken reader forever.
  if (!FEED_ROOT_RE.test(doc)) {
    throw new FeedParseError(
      "That URL returned a web page, not an RSS or Atom feed. Look for a feed link on the site — often /feed, /rss.xml, or /atom.xml.",
    );
  }

  const feedTitle = parseFeedTitle(doc.replace(blockRe, ""));

  const items: FeedItem[] = [];
  for (const block of blocks) {
    if (items.length >= MAX_ITEMS) break;
    const inner = block[2];

    const rawTitle = tagBody(inner, "title");
    const title = rawTitle ? toPlainText(rawTitle) : "";

    const rawLink = tagBody(inner, "link");
    const linkText = rawLink ? toPlainText(rawLink) : "";
    const href = linkText || atomLink(inner) || toPlainText(tagBody(inner, "guid") ?? "");
    const link = href && /^https?:\/\//i.test(href) ? href : href ? resolveUrl(href, baseUrl) : "";

    const publishedAt =
      toIsoDate(tagBody(inner, "pubDate")) ??
      toIsoDate(tagBody(inner, "published")) ??
      toIsoDate(tagBody(inner, "updated")) ??
      toIsoDate(tagBody(inner, "date"));

    const rawSummary =
      tagBody(inner, "description") ??
      tagBody(inner, "summary") ??
      tagBody(inner, "encoded") ??
      tagBody(inner, "content") ??
      "";
    const summary = truncate(toPlainText(rawSummary), SUMMARY_LENGTH);

    if (!title && !link) continue;

    items.push({ title: title || link || "Untitled", link, publishedAt, summary });
  }

  if (blocks.length === 0 && !feedTitle) {
    throw new FeedParseError(
      "No RSS <item> or Atom <entry> elements found — is this actually a feed URL?",
    );
  }

  return { title: feedTitle, items };
}

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Provide a well-formed http:// or https:// feed URL." }, { status: 400 });
    }

    let xml: string;
    try {
      const res = await safeFetch(parsedUrl.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "Mozilla/5.0 (compatible; RSSReaderBot/1.0)",
        },
      });

      // safeFetch never follows redirects (that is how the redirect-to-internal-address
      // bypass is prevented), so surface a 3xx as an actionable error.
      if (res.status >= 300 && res.status < 400) {
        return NextResponse.json(
          {
            error: `That feed responded with a redirect (${res.status}). For security we do not follow redirects — subscribe with the final feed URL.`,
          },
          { status: 400 },
        );
      }
      if (!res.ok) {
        return NextResponse.json({ error: `Feed request failed with status ${res.status}.` }, { status: 400 });
      }
      xml = await res.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch feed.";
      if (message === BLOCKED_TARGET_MESSAGE) {
        return NextResponse.json(
          { error: "That URL points to a private, local, or otherwise non-public address and cannot be fetched." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: `Could not fetch feed: ${message}` }, { status: 400 });
    }

    if (!xml.trim()) {
      return NextResponse.json({ error: "The feed responded with an empty body." }, { status: 400 });
    }

    // A document we cannot make sense of is the caller's input problem, not a
    // server fault — 400 keeps the client's error message actionable.
    let result: FeedResult;
    try {
      result = parseFeed(xml, parsedUrl.toString());
    } catch (err) {
      const message =
        err instanceof FeedParseError ? err.message : "Could not parse that feed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse feed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
