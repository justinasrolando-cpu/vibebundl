"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatWidget({ slug, botName }: { slug: string; botName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Fresh session per page load — good enough for MVP.
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const canSend = input.trim().length > 0 && !sending && !!sessionId;

  const handleSend = async () => {
    if (!canSend || !sessionId) return;
    setError(null);
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimisticUser: Message = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Failed to send message.");
        setSending(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: data.reply as string },
      ]);
    } catch {
      setError("Failed to send message.");
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="border-b border-border p-4">
        <h1 className="text-sm font-semibold">{botName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">Ask a question to get started.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-accent text-background" : "bg-surface-hover text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-surface-hover px-3 py-2 text-sm text-muted">
                  Typing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-xs text-danger">{error}</p>}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          className="input min-h-[44px] flex-1 resize-none text-sm"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className="btn btn-primary shrink-0 text-sm" onClick={handleSend} disabled={!canSend}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </>
  );
}
