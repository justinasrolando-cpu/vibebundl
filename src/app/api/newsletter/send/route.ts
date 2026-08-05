import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends a saved campaign to every subscriber owned by the calling user via
 * Resend's REST API.
 *
 * Sends go out in small sequential chunks rather than all at once: Resend
 * rate-limits per second, and a 500-address list fired in parallel would get
 * throttled. Individual failures are counted, never fatal — one bad address
 * must not stop the rest of the list.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function sendOne(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const post = () =>
    fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });

  try {
    let res = await post();

    // One polite retry if we still tripped the rate limiter.
    if (res.status === 429) {
      await sleep(1500);
      res = await post();
    }

    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    let body: { campaign_id?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const campaignId = body.campaign_id;
    if (!campaignId) {
      return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return NextResponse.json(
        {
          error:
            "Email sending isn't configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.",
        },
        { status: 500 },
      );
    }

    const { data: campaign, error: campaignErr } = await supabase
      .from("newsletter_campaigns")
      .select("id, subject, body, sent_at")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.sent_at) {
      return NextResponse.json(
        { error: "This campaign has already been sent." },
        { status: 400 },
      );
    }

    const { data: subscribers, error: subscriberErr } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .eq("user_id", user.id);

    if (subscriberErr) {
      return NextResponse.json({ error: subscriberErr.message }, { status: 500 });
    }

    const recipients = Array.from(
      new Set(
        (subscribers ?? [])
          .map((s: { email: string }) => s.email?.trim())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "You have no subscribers yet — add at least one before sending." },
        { status: 400 },
      );
    }

    let sent = 0;
    let failed = 0;

    const batches = chunk(recipients, CHUNK_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const results = await Promise.all(
        batches[i].map((to) => sendOne(apiKey, from, to, campaign.subject, campaign.body)),
      );
      for (const ok of results) {
        if (ok) sent++;
        else failed++;
      }
      if (i < batches.length - 1) await sleep(CHUNK_DELAY_MS);
    }

    if (sent > 0) {
      const { error: updateErr } = await supabase
        .from("newsletter_campaigns")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("user_id", user.id);

      if (updateErr) {
        return NextResponse.json(
          {
            error: `Sent to ${sent} subscriber(s), but marking the campaign as sent failed: ${updateErr.message}`,
            sent,
            failed,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send campaign.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
