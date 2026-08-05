"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Snippet = {
  id: string;
  user_id: string;
  title: string;
  language: string;
  body: string;
  tags: string[] | null;
  created_at: string;
};

const LANGUAGES = [
  "text",
  "javascript",
  "typescript",
  "python",
  "go",
  "rust",
  "sql",
  "bash",
  "json",
  "html",
  "css",
] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

export default function SnippetsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);

  // Editor draft state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLanguage, setDraftLanguage] = useState<string>("text");
  const [draftTags, setDraftTags] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [dirty, setDirty] = useState(false);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("snippets")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setSnippets((data ?? []) as Snippet[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoadError("You must be signed in to view your snippets.");
        return;
      }
      setUserId(user.id);
      await load(user.id);
    })();
  }, [supabase, load]);

  const selected = useMemo(
    () => snippets.find((s) => s.id === selectedId) ?? null,
    [snippets, selectedId],
  );

  // Sync draft whenever the selection changes.
  useEffect(() => {
    setActionError(null);
    setCopied(false);
    if (selected) {
      setDraftTitle(selected.title ?? "");
      setDraftLanguage(selected.language || "text");
      setDraftTags((selected.tags ?? []).join(", "));
      setDraftBody(selected.body ?? "");
    } else {
      setDraftTitle("");
      setDraftLanguage("text");
      setDraftTags("");
      setDraftBody("");
    }
    setDirty(false);
  }, [selected]);

  const languageChips = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.language) set.add(s.language);
    });
    return Array.from(set).sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snippets.filter((s) => {
      const matchesLanguage = !activeLanguage || s.language === activeLanguage;
      if (!matchesLanguage) return false;
      if (!q) return true;
      return (
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.body ?? "").toLowerCase().includes(q) ||
        (s.language ?? "").toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [snippets, search, activeLanguage]);

  // Warn before losing unsaved edits on refresh/close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const selectSnippet = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !confirm("This snippet has unsaved changes. Switch and discard them?")) return;
    setSelectedId(id);
  };

  const handleNew = async () => {
    if (!userId || creating) return;
    if (dirty && !confirm("This snippet has unsaved changes. Create a new one and discard them?"))
      return;
    setActionError(null);
    setCreating(true);
    const { data, error } = await supabase
      .from("snippets")
      .insert({
        user_id: userId,
        title: "Untitled",
        language: "text",
        body: "",
        tags: [],
      })
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not create the snippet.");
    } else {
      const created = data as Snippet;
      setSnippets((prev) => [created, ...prev]);
      setSelectedId(created.id);
    }
    setCreating(false);
  };

  const handleSave = async () => {
    if (!selected || !userId) return;
    setActionError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("snippets")
      .update({
        title: draftTitle.trim() || "Untitled",
        language: draftLanguage || "text",
        body: draftBody,
        tags: parseTags(draftTags),
      })
      .eq("id", selected.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not save the snippet.");
    } else {
      const updated = data as Snippet;
      setSnippets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDirty(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !userId) return;
    if (!confirm(`Delete "${selected.title || "Untitled"}"? This cannot be undone.`)) return;
    setActionError(null);
    setDeleting(true);
    const id = selected.id;
    const { error } = await supabase
      .from("snippets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      setActionError(error.message);
    } else {
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      setSelectedId(null);
    }
    setDeleting(false);
  };

  const handleCopy = async () => {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(draftBody);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setActionError("Clipboard access was blocked. Select the code and copy manually.");
    }
  };

  const lineCount = draftBody ? draftBody.split("\n").length : 0;

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left pane: list */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-80 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 pb-3">
          <div>
            <h1 className="text-lg font-semibold">Snippets</h1>
            <p className="mt-0.5 text-xs text-muted">
              {loading
                ? "Loading…"
                : `${snippets.length} saved${
                    languageChips.length > 0 ? ` · ${languageChips.length} languages` : ""
                  }`}
            </p>
          </div>
          <button
            className="btn btn-primary shrink-0 text-xs"
            onClick={handleNew}
            disabled={creating || !userId}
          >
            {creating ? "Adding…" : "+ New"}
          </button>
        </div>

        <div className="px-4 pb-3">
          <input
            className="input w-full"
            placeholder="Search title, code, language…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {languageChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            <button
              onClick={() => setActiveLanguage(null)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                activeLanguage === null
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              all
            </button>
            {languageChips.map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLanguage(lang === activeLanguage ? null : lang)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  activeLanguage === lang
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p className="px-2 py-4 text-sm text-danger">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              {snippets.length === 0
                ? "No snippets yet. Hit “+ New” to save your first bit of code — give it a language and tags so you can find it later."
                : "No snippets match your search or language filter."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => selectSnippet(s.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      s.id === selectedId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.title || "Untitled"}
                      </p>
                      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {s.language || "text"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {(s.body || "").split("\n").find((l) => l.trim()) || "Empty snippet"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">{formatDate(s.created_at)}</span>
                      {(s.tags ?? []).slice(0, 3).map((t) => (
                        <span key={t} className="text-xs text-accent">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right pane: editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="card flex h-full min-h-[300px] items-center justify-center p-8 text-center">
            <p className="max-w-sm text-sm text-muted">
              Select a snippet on the left, or create a new one to paste in code you keep
              re-typing.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                className="input min-w-0 flex-1 text-base font-medium"
                placeholder="Title"
                value={draftTitle}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  setDirty(true);
                }}
              />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">
                  {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
                </span>
                <button
                  className="btn btn-primary text-xs"
                  onClick={handleSave}
                  disabled={saving || deleting || !dirty}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  className="btn btn-secondary text-xs text-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">
                  Language <span className="text-muted-2">(label for filtering — no highlighting)</span>
                </span>
                <select
                  className="input w-full text-sm"
                  value={draftLanguage}
                  onChange={(e) => {
                    setDraftLanguage(e.target.value);
                    setDirty(true);
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                  {!LANGUAGES.includes(draftLanguage as (typeof LANGUAGES)[number]) && (
                    <option value={draftLanguage}>{draftLanguage}</option>
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Tags</span>
                <input
                  className="input w-full text-sm"
                  placeholder="Comma separated (e.g. auth, regex)"
                  value={draftTags}
                  onChange={(e) => {
                    setDraftTags(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">
                  Code{lineCount > 0 ? ` · ${lineCount} line${lineCount === 1 ? "" : "s"}` : ""}
                </span>
                <button
                  className="btn btn-primary text-xs"
                  onClick={handleCopy}
                  disabled={!draftBody}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                className="input min-h-[420px] w-full resize-y font-mono text-sm leading-relaxed"
                placeholder="Paste your code here…"
                spellCheck={false}
                value={draftBody}
                onChange={(e) => {
                  setDraftBody(e.target.value);
                  setDirty(true);
                }}
              />
            </div>

            {actionError && <p className="text-sm text-danger">{actionError}</p>}
          </div>
        )}

        {!selected && actionError && (
          <p className="mt-3 text-sm text-danger">{actionError}</p>
        )}
      </div>
    </div>
  );
}
