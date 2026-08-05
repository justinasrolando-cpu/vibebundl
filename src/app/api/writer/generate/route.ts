import { NextRequest, NextResponse } from "next/server";
import { getActiveSubscription } from "@/lib/subscription";

const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  Headline: "Write 5 punchy headline options for",
  "Cold Email": "Write a short, persuasive cold outreach email for",
  "Ad Copy": "Write 3 variations of short, high-converting ad copy for",
  "Product Description": "Write a compelling product description for",
};

export async function POST(req: NextRequest) {
  // This route spends real money on every call, so it is gated twice: you must
  // be signed in, and you must have an active subscription. Without this the
  // endpoint is an open, unmetered LLM proxy for anyone who finds the URL.
  const { user, hasAccess } = await getActiveSubscription();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasAccess) {
    return NextResponse.json({ error: "An active subscription is required." }, { status: 403 });
  }

  let body: { template?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const template = body.template?.trim();
  const prompt = body.prompt?.trim();

  if (!template || !prompt) {
    return NextResponse.json({ error: "template and prompt are required." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  const instruction = TEMPLATE_INSTRUCTIONS[template] ?? `Write content in the style of "${template}" for`;
  const userMessage = `${instruction}: ${prompt}`;

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
        max_tokens: 512,
        messages: [{ role: "user", content: userMessage }],
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

    return NextResponse.json({ output: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Anthropic API.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
