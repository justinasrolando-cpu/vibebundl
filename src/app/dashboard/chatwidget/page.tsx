"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type ChatBot = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  // `knowledge_base` is `not null default ''` in the schema — never null.
  knowledge_base: string;
  created_at: string;
};

/** Final form, used on save: no leading/trailing dashes. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * While typing we only strip characters that can never appear in a slug. The
 * full slugify() also trims trailing dashes, which made it impossible to type
 * a multi-word slug: every "-" you typed was deleted on the next keystroke.
 */
function slugifyPartial(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

export default function ChatWidgetPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [bots, setBots] = useState<ChatBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [draftName, setDraftName] = useState("Assistant");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftSlugTouched, setDraftSlugTouched] = useState(false);
  const [draftKnowledge, setDraftKnowledge] = useState("");

  const loadBots = useCallback(async (ownerId: string | null) => {
    setLoading(true);
    if (!ownerId) {
      setBots([]);
      setListError("You are signed out. Sign in again to manage your bots.");
      setLoading(false);
      return;
    }
    const { data, error: loadFailed } = await supabase
      .from("chat_bots")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false });
    if (loadFailed) {
      setListError(loadFailed.message);
    } else {
      setListError(null);
      setBots((data ?? []) as ChatBot[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadBots(user?.id ?? null);
    })();
  }, [supabase, loadBots]);

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedId) ?? null,
    [bots, selectedId],
  );

  useEffect(() => {
    if (selectedBot) {
      setDraftName(selectedBot.name ?? "Assistant");
      setDraftSlug(selectedBot.slug ?? "");
      setDraftKnowledge(selectedBot.knowledge_base ?? "");
      setDraftSlugTouched(true);
    } else {
      setDraftName("Assistant");
      setDraftSlug("");
      setDraftKnowledge("");
      setDraftSlugTouched(false);
    }
    setError(null);
    setCopied(false);
  }, [selectedBot]);

  const handleNew = () => {
    setSelectedId(null);
    setDraftName("Assistant");
    setDraftSlug("");
    setDraftKnowledge("");
    setDraftSlugTouched(false);
    setError(null);
  };

  const handleNameChange = (value: string) => {
    setDraftName(value);
    if (!draftSlugTouched) {
      setDraftSlug(slugify(value));
    }
  };

  const handleSave = async () => {
    if (!userId) {
      setError("You are signed out. Sign in again to save this bot.");
      return;
    }
    setError(null);

    const cleanSlug = slugify(draftSlug);
    if (!cleanSlug) {
      setError("Slug is required — it becomes the public URL for this bot.");
      return;
    }
    if (!draftKnowledge.trim()) {
      setError("Add a knowledge base first — the bot can only answer from what you paste here.");
      return;
    }
    setDraftSlug(cleanSlug);

    setSaving(true);

    if (selectedBot) {
      const { data, error: updateError } = await supabase
        .from("chat_bots")
        .update({
          name: draftName || "Assistant",
          slug: cleanSlug,
          knowledge_base: draftKnowledge,
        })
        .eq("id", selectedBot.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "That slug is already taken. Choose another."
            : updateError.message,
        );
        setSaving(false);
        return;
      }

      setBots((prev) => prev.map((b) => (b.id === selectedBot.id ? (data as ChatBot) : b)));
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("chat_bots")
      .insert({
        user_id: userId,
        name: draftName || "Assistant",
        slug: cleanSlug,
        knowledge_base: draftKnowledge,
      })
      .select()
      .single();

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That slug is already taken. Choose another."
          : insertError.message,
      );
      setSaving(false);
      return;
    }

    setBots((prev) => [data as ChatBot, ...prev]);
    setSelectedId((data as ChatBot).id);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedBot || !userId) return;
    if (
      !confirm(
        `Delete "${selectedBot.name}"? The public link /c/${selectedBot.slug} will stop working and the conversation history goes with it. This cannot be undone.`,
      )
    )
      return;
    const { error: deleteError } = await supabase
      .from("chat_bots")
      .delete()
      .eq("id", selectedBot.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setError(null);
    setBots((prev) => prev.filter((b) => b.id !== selectedBot.id));
    setSelectedId(null);
  };

  const embedUrl = selectedBot && typeof window !== "undefined"
    ? `${window.location.origin}/c/${selectedBot.slug}`
    : selectedBot
      ? `/c/${selectedBot.slug}`
      : "";

  const handleCopy = async () => {
    if (!embedUrl) return;
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left pane: list */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-80 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 pb-3">
          <h1 className="text-lg font-semibold">AI Chat Widget</h1>
          <button className="btn btn-primary text-xs" onClick={handleNew}>
            + New bot
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : listError ? (
            <p className="px-2 py-4 text-sm text-danger">{listError}</p>
          ) : bots.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No bots yet. Create one, paste in your FAQ or docs as a knowledge base, then share
              the public link with your customers.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {bots.map((bot) => (
                <li key={bot.id}>
                  <button
                    onClick={() => setSelectedId(bot.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      bot.id === selectedId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{bot.name || "Assistant"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">/c/{bot.slug}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right pane: editor */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {selectedBot ? "Edit bot" : "New bot"}
            </h2>
            {selectedBot && (
              <button className="btn btn-secondary text-xs text-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Bot name</label>
            <input
              className="input w-full"
              placeholder="Assistant"
              value={draftName}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Slug (used in the public URL)</label>
            <input
              className="input w-full"
              placeholder="my-support-bot"
              value={draftSlug}
              onChange={(e) => {
                setDraftSlugTouched(true);
                setDraftSlug(slugifyPartial(e.target.value));
              }}
              onBlur={() => setDraftSlug(slugify(draftSlug))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">
              Knowledge base (plain text — paste your FAQ, docs, or policies)
            </label>
            <textarea
              className="input min-h-[300px] w-full resize-y font-mono text-sm leading-relaxed"
              placeholder={"Q: What are your hours?\nA: We're open 9am-5pm ET, Monday to Friday.\n\nQ: What is your refund policy?\nA: ..."}
              value={draftKnowledge}
              onChange={(e) => setDraftKnowledge(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-2">
            <button className="btn btn-primary text-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : selectedBot ? "Save changes" : "Create bot"}
            </button>
          </div>

          {selectedBot && (
            <div className="card mt-2 p-4">
              <p className="text-xs text-muted">Public embed URL</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="input flex-1 overflow-x-auto whitespace-nowrap text-xs">
                  {embedUrl}
                </code>
                <button className="btn btn-secondary shrink-0 text-xs" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Embed this on your site by dropping the URL in an &lt;iframe&gt; — simplest embed
                story, no script needed:
              </p>
              <pre className="input mt-2 w-full overflow-x-auto whitespace-pre text-xs">
                {`<iframe src="${embedUrl}" width="380" height="560" style="border:0;border-radius:12px" title="${draftName || "Assistant"} chat"></iframe>`}
              </pre>
              <p className="mt-2 text-xs text-muted">
                Or just link to the URL directly (e.g. a &quot;Chat with us&quot; button). Each
                visitor gets a fresh conversation scoped to their own session, answered from the
                knowledge base above.
              </p>
              <p className="mt-2 text-xs text-muted-2">
                Limits, so a stray visitor can&apos;t run up your bill: 2,000 characters per
                message and 40 messages per conversation. The bot answers from the pasted text
                only — it does not crawl your website, and it has no lead capture or human
                handoff. Conversations are stored but there is no inbox to read them in yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
