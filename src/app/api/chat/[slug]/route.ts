import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ChatBot = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  // `not null default ''` in the schema.
  knowledge_base: string;
};

type ChatMessage = {
  id: string;
  bot_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const MAX_MESSAGE_CHARS = 2000;
const MAX_MESSAGES_PER_SESSION = 40;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: { session_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const message = body.message?.trim();

  if (!sessionId || !message) {
    return NextResponse.json({ error: "session_id and message are required." }, { status: 400 });
  }

  // This endpoint is intentionally public (visitors chat with an owner's bot),
  // which means it is also the one place a stranger can spend our Anthropic
  // budget. Cap the two things that drive cost: how big a single prompt can be,
  // and how long one session can keep going.
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` },
      { status: 400 },
    );
  }
  if (sessionId.length > 100) {
    return NextResponse.json({ error: "Invalid session_id." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const supabase = createAdminClient();

    const { data: bot, error: botError } = await supabase
      .from("chat_bots")
      .select("id, user_id, slug, name, knowledge_base")
      .eq("slug", slug)
      .maybeSingle<ChatBot>();

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found." }, { status: 404 });
    }

    // Stop a single session being looped forever to run up token spend.
    const { count: turnCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("bot_id", bot.id)
      .eq("session_id", sessionId);

    if ((turnCount ?? 0) >= MAX_MESSAGES_PER_SESSION) {
      return NextResponse.json(
        { error: "This conversation has reached its limit. Start a new chat to continue." },
        { status: 429 },
      );
    }

    const { error: insertUserError } = await supabase
      .from("chat_messages")
      .insert({ bot_id: bot.id, session_id: sessionId, role: "user", content: message });

    if (insertUserError) {
      return NextResponse.json({ error: insertUserError.message }, { status: 500 });
    }

    // Newest-first + reverse, NOT oldest-first + limit: ordering ascending with
    // a limit pins the window to the opening 20 turns, so from turn 21 on the
    // model answers an old message and the final turn is an assistant one,
    // which the Messages API rejects outright.
    const { data: history, error: historyError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("bot_id", bot.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyError || !history || history.length === 0) {
      return NextResponse.json(
        { error: historyError?.message ?? "Failed to load conversation history." },
        { status: 500 },
      );
    }

    const ordered = (history as ChatMessage[]).slice().reverse();

    // The window can start mid-exchange; the API requires the first message to
    // be a user turn, so drop any leading assistant replies.
    const firstUserIndex = ordered.findIndex((m) => m.role === "user");
    const conversation = (firstUserIndex === -1 ? [] : ordered.slice(firstUserIndex)).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Failed to load conversation history." }, { status: 500 });
    }

    const instruction =
      "You are a support assistant. Only answer using this knowledge base, and say you don't know if the answer isn't in it:\n\n" +
      (bot.knowledge_base ?? "");

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
        system: instruction,
        messages: conversation,
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

    const { error: insertAssistantError } = await supabase
      .from("chat_messages")
      .insert({ bot_id: bot.id, session_id: sessionId, role: "assistant", content: text });

    if (insertAssistantError) {
      return NextResponse.json({ error: insertAssistantError.message }, { status: 500 });
    }

    return NextResponse.json({ reply: text });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "Failed to process chat message.";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
