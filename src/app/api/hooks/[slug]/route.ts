import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type WebhookRelay = {
  id: string;
  user_id: string;
  slug: string;
  target_url: string;
  created_at: string;
};

// Basic SSRF hardening: only allow http/https targets whose hostname isn't
// localhost, a loopback/link-local address, or in a private IP range.
function isTargetAllowed(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1") return false;
  if (hostname.startsWith("127.")) return false;

  // IPv4 private ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  // Link-local
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;

  // IPv6 unique local / link-local
  if (hostname.startsWith("fc") || hostname.startsWith("fd")) return false;
  if (hostname.startsWith("fe80")) return false;

  return true;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = createAdminClient();

  const { data: relay, error: relayError } = await supabase
    .from("webhook_relays")
    .select("id, user_id, slug, target_url, created_at")
    .eq("slug", slug)
    .maybeSingle<WebhookRelay>();

  if (relayError || !relay) {
    return NextResponse.json({ error: "Relay not found." }, { status: 404 });
  }

  const rawBody = await req.text();
  let payload: unknown;
  try {
    payload = rawBody.length ? JSON.parse(rawBody) : {};
  } catch {
    payload = { raw: rawBody };
  }
  // webhook_logs.payload is `jsonb not null default '{}'`, and a body of
  // literal "null" parses to null — which the NOT NULL constraint rejects.
  if (payload === null || payload === undefined) {
    payload = {};
  }

  let forwardedStatus: number | null = null;
  let redirectRefused = false;

  if (!isTargetAllowed(relay.target_url)) {
    // Blocked by SSRF guard: don't forward, log with forwarded_status null.
    forwardedStatus = null;
  } else {
    try {
      const res = await fetch(relay.target_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        // Don't follow redirects: a 3xx would send the request to a hostname
        // that isTargetAllowed() never checked (e.g. 169.254.169.254), so
        // following it would bypass the SSRF guard entirely.
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      forwardedStatus = res.status;
      // A redirect is not a successful forward — record the 3xx and refuse.
      if (res.status >= 300 && res.status < 400) {
        redirectRefused = true;
      }
    } catch {
      forwardedStatus = null;
    }
  }

  await supabase.from("webhook_logs").insert({
    relay_id: relay.id,
    payload,
    forwarded_status: forwardedStatus,
  });

  if (redirectRefused) {
    return NextResponse.json({
      received: true,
      forwarded: false,
      forwarded_status: forwardedStatus,
      error: "Forward refused: target responded with a redirect, which is not followed.",
    });
  }

  // Always report success to the caller — a downstream forwarding failure
  // (or a blocked target) is expected/logged, not an error for the sender.
  return NextResponse.json({ received: true, forwarded_status: forwardedStatus });
}
