/**
 * Where a `?next=` parameter is allowed to send someone.
 *
 * `startsWith("/")` is the obvious check and it is wrong twice over:
 *
 *   "//evil.com"  → a protocol-relative URL. The browser resolves it
 *                   against the current scheme and navigates off-site.
 *   "\\evil.com"  → the same trick with backslashes, which several
 *                   parsers normalise to forward slashes.
 *
 * And on the server, string-concatenating `${origin}${next}` opens a
 * third: `origin` has no trailing slash, so "@evil.com" produces
 * "https://vibebundl.com@evil.com" — a userinfo prefix, host evil.com.
 * That is a phishing redirector hosted on our own apex domain, reachable
 * with no session at all.
 *
 * So: require a leading "/" that is NOT followed by another "/" or a
 * backslash, and never concatenate — resolve against a base URL.
 */
export const DEFAULT_NEXT = "/dashboard";

const SAFE_PATH = /^\/(?![/\\])[^\s]*$/;

export function safeNext(raw: unknown, fallback: string = DEFAULT_NEXT): string {
  if (typeof raw !== "string") return fallback;
  if (raw.length > 512) return fallback;
  return SAFE_PATH.test(raw) ? raw : fallback;
}
