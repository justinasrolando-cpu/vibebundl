import { NextRequest, NextResponse } from "next/server";
import { getActiveSubscription } from "@/lib/subscription";

const SYSTEM_PROMPT =
  "You are an assistant that turns raw meeting transcripts into a concise, well-structured summary. " +
  "Format your response in markdown with these sections (omit a section if there is truly nothing for it): " +
  "## Key Points, ## Decisions, ## Action Items (use a bullet list, prefix each with the owner's name if mentioned). " +
  "Be concise and factual. Do not invent information that isn't in the transcript.";

export async function POST(req: NextRequest) {
  // Paid LLM call — gate on sign-in + active subscription, or this is a free
  // summarisation API for the whole internet, billed to us.
  const { user, hasAccess } = await getActiveSubscription();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasAccess) {
    return NextResponse.json({ error: "An active subscription is required." }, { status: 403 });
  }

  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "transcript is required." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Summarize this meeting transcript:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Anthropic API error (${res.status}): ${errText || res.statusText}` },
        { status: 500 },
      );
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;

    if (typeof text !== "string") {
      return NextResponse.json({ error: "Unexpected response shape from Anthropic API." }, { status: 500 });
    }

    return NextResponse.json({ summary: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Anthropic API.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
