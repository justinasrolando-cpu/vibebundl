/**
 * Shared SSRF guard.
 *
 * Server routes that fetch a user-supplied URL must run the target through
 * `isPubliclyRoutableUrl` (or just use `safeFetch`) so that attackers cannot
 * point the server at loopback, private, or cloud-metadata addresses.
 */

/** Hostnames that are never allowed, regardless of encoding. */
const BLOCKED_EXACT_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "::",
  "[::]",
  "::1",
  "[::1]",
]);

/**
 * Bare decimal / octal / hex integers are alternate encodings of IPv4
 * addresses (2130706433 === 0x7f000001 === 0177.0.0.1 === 127.0.0.1) and
 * would slip past plain string prefix checks, so reject them outright.
 */
const NUMERIC_HOST_RE = /^(0x[0-9a-f]+|0[0-7]+|\d+)$/i;

function isBlockedHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().trim();
  if (!hostname) return true;

  // Strip IPv6 brackets: "[::1]" -> "::1"
  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (BLOCKED_EXACT_HOSTS.has(hostname) || BLOCKED_EXACT_HOSTS.has(bare)) return true;

  // localhost and any *.localhost subdomain
  if (bare === "localhost" || bare.endsWith(".localhost")) return true;

  // Alternate integer encodings of an IP address (decimal / octal / hex).
  if (NUMERIC_HOST_RE.test(bare)) return true;

  // IPv4 loopback 127.0.0.0/8
  if (/^127\./.test(bare)) return true;

  // IPv4 private ranges: 10/8, 192.168/16, 172.16/12
  if (/^10\./.test(bare)) return true;
  if (/^192\.168\./.test(bare)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(bare)) return true;

  // IPv4 link-local / cloud metadata (169.254.169.254 lives here)
  if (/^169\.254\./.test(bare)) return true;

  // Anything below only applies to IPv6 literals — a colon is the tell. Guarding
  // on it keeps real domains such as "fdic.gov" or "fe80labs.com" routable.
  if (bare.includes(":")) {
    // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
    if (/^f[cd]/.test(bare)) return true;
    if (bare.startsWith("fe80")) return true;

    // IPv4-mapped / IPv4-compatible IPv6 forms embedding a private literal,
    // e.g. "::ffff:127.0.0.1" or "::ffff:169.254.169.254".
    const embedded = bare.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (embedded && isBlockedHostname(embedded[1])) return true;
    // Compressed IPv4-mapped loopback, e.g. "::ffff:7f00:1"
    if (/^::(ffff:)?(0*7f[0-9a-f]{0,2}:|0*a[0-9a-f]{0,2}:)/.test(bare)) return true;
  }

  return false;
}

/**
 * Returns true only for http(s) URLs whose hostname is a publicly routable
 * address. Any parse failure, non-http protocol, or private/loopback/
 * link-local target returns false.
 */
export function isPubliclyRoutableUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return !isBlockedHostname(url.hostname);
  } catch {
    return false;
  }
}

export const BLOCKED_TARGET_MESSAGE = "Blocked: target is not publicly routable";

/**
 * fetch() wrapper that refuses non-public targets.
 *
 * `redirect: "manual"` is essential: without it, an attacker can supply a
 * perfectly public URL that responds with a 302 to http://169.254.169.254/ or
 * another internal address, and fetch would follow it — bypassing the hostname
 * check entirely. With manual redirects the 3xx comes back as a response and
 * the caller decides what to do with it.
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isPubliclyRoutableUrl(url)) {
    throw new Error(BLOCKED_TARGET_MESSAGE);
  }
  return fetch(url, { ...init, redirect: "manual" });
}
