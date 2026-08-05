"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type WikiPage = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  updated_at: string;
  created_at: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline replacements. Input is ALREADY html-escaped by renderMarkdownLite.
function renderInline(text: string): string {
  return text
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-surface-hover px-1 py-0.5 font-mono text-[0.85em]">$1</code>',
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-accent underline underline-offset-2">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Markdown-lite: #/##/### headings, **bold**, *italic*, `code`, [text](url),
// "- " list items, and line breaks. HTML is escaped FIRST so nothing can be injected.
function renderMarkdownLite(input: string): string {
  const escaped = escapeHtml(input ?? "");
  const lines = escaped.split("\n");

  const out: string[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      out.push(
        `<ul class="my-2 list-disc space-y-1 pl-5">${listItems
          .map((li) => `<li>${renderInline(li)}</li>`)
          .join("")}</ul>`,
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(
        `<p class="my-2">${paragraph.map((l) => renderInline(l)).join("<br/>")}</p>`,
      );
      paragraph = [];
    }
  };

  const headingClass: Record<number, string> = {
    1: "mt-4 mb-2 text-xl font-semibold tracking-tight",
    2: "mt-4 mb-2 text-lg font-semibold tracking-tight",
    3: "mt-3 mb-1.5 text-base font-semibold tracking-tight",
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(
        `<h${level + 1} class="${headingClass[level]}">${renderInline(heading[2])}</h${level + 1}>`,
      );
      continue;
    }

    const item = line.match(/^\s*[-+]\s+(.*)$/) ?? line.match(/^\s*\*\s+(.*)$/);
    if (item) {
      flushParagraph();
      listItems.push(item[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return out.join("");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WikiPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftPublished, setDraftPublished] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setLoading(false);
      setError("You need to be signed in to manage your wiki.");
      return;
    }
    setUser(authUser);

    const { data, error: selectError } = await supabase
      .from("wiki_pages")
      .select("*")
      .eq("user_id", authUser.id)
      .order("updated_at", { ascending: false });

    if (selectError) {
      setError(selectError.message);
    } else {
      setPages((data ?? []) as WikiPage[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => pages.find((p) => p.id === selectedId) ?? null,
    [pages, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setDraftTitle(selected.title ?? "");
      setDraftSlug(selected.slug ?? "");
      setDraftBody(selected.body ?? "");
      setDraftPublished(Boolean(selected.published));
      setSlugTouched(true);
    } else {
      setDraftTitle("");
      setDraftSlug("");
      setDraftBody("");
      setDraftPublished(false);
      setSlugTouched(false);
    }
    setDirty(false);
    setCopied(false);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.slug ?? "").toLowerCase().includes(q),
    );
  }, [pages, search]);

  const previewHtml = useMemo(() => renderMarkdownLite(draftBody), [draftBody]);

  function friendlyError(message: string): string {
    if (message.toLowerCase().includes("duplicate") || message.includes("23505")) {
      return "That slug is already taken. Try a different one.";
    }
    return message;
  }

  async function handleNew() {
    if (!user) return;
    setCreating(true);
    setError(null);
    const suffix = Math.random().toString(36).slice(2, 7);
    const { data, error: insertError } = await supabase
      .from("wiki_pages")
      .insert({
        user_id: user.id,
        slug: `untitled-${suffix}`,
        title: "Untitled",
        body: "",
        published: false,
      })
      .select()
      .single();

    if (insertError) {
      setError(friendlyError(insertError.message));
    } else if (data) {
      const page = data as WikiPage;
      setPages((prev) => [page, ...prev]);
      setSelectedId(page.id);
      setSlugTouched(false);
    }
    setCreating(false);
  }

  async function handleSave() {
    if (!selected || !user) return;
    setError(null);

    const cleanSlug = slugify(draftSlug || draftTitle);
    if (!cleanSlug) {
      setError("Please enter a slug (letters, numbers, and dashes).");
      return;
    }

    setSaving(true);
    const { data, error: updateError } = await supabase
      .from("wiki_pages")
      .update({
        title: draftTitle.trim() || "Untitled",
        slug: cleanSlug,
        body: draftBody,
        published: draftPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      setError(friendlyError(updateError.message));
    } else if (data) {
      const page = data as WikiPage;
      setPages((prev) =>
        prev
          .map((p) => (p.id === page.id ? page : p))
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          ),
      );
      setDraftSlug(page.slug);
      setDirty(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!selected || !user) return;
    if (!confirm(`Delete "${selected.title || "Untitled"}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("wiki_pages")
      .delete()
      .eq("id", selected.id)
      .eq("user_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setPages((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(null);
    }
    setDeleting(false);
  }

  function copyPublicUrl() {
    if (!selected) return;
    navigator.clipboard
      .writeText(`${origin}/docs/${selected.slug}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setError("Could not copy to the clipboard."));
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sidebar: page list */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-72 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 p-4 pb-3">
          <div>
            <h1 className="text-lg font-semibold">Wiki &amp; Docs</h1>
            <p className="text-xs text-muted">Internal docs, publishable.</p>
          </div>
          <button
            className="btn btn-primary shrink-0 text-xs"
            onClick={handleNew}
            disabled={creating || !user}
          >
            {creating ? "…" : "+ New"}
          </button>
        </div>

        <div className="px-4 pb-3">
          <input
            className="input w-full"
            placeholder="Search pages by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : !user ? (
            <p className="px-2 py-4 text-sm text-danger">
              {error ?? "You need to be signed in to manage your wiki."}
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              {pages.length === 0
                ? "No pages yet. Create your first page to start writing your handbook."
                : "No pages match that search. Try another title."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((page) => (
                <li key={page.id}>
                  <button
                    onClick={() => setSelectedId(page.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      page.id === selectedId
                        ? "bg-surface-hover"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {page.title || "Untitled"}
                      </p>
                      {page.published && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent">
                          live
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">/docs/{page.slug}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(page.updated_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="card flex h-full min-h-[300px] items-center justify-center p-8 text-center">
            {error ? (
              <p className="max-w-sm text-sm text-danger">{error}</p>
            ) : (
              <p className="max-w-sm text-sm text-muted">
                Select a page on the left, or create a new one. Any page can be published to a
                public /docs URL — pages stay private until you tick Published.
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                className="input min-w-0 flex-1 text-base font-medium"
                placeholder="Page title"
                value={draftTitle}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftTitle(value);
                  if (!slugTouched) setDraftSlug(slugify(value));
                  setDirty(true);
                }}
              />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">
                  {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
                </span>
                <button
                  className="btn btn-primary text-xs"
                  onClick={handleSave}
                  disabled={saving}
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

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[16rem] flex-1 items-center gap-1">
                <span className="shrink-0 text-xs text-muted">/docs/</span>
                <input
                  className="input min-w-0 flex-1 font-mono text-xs"
                  placeholder="page-slug"
                  value={draftSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setDraftSlug(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={() => setDraftSlug((s) => slugify(s))}
                />
              </div>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={draftPublished}
                  onChange={(e) => {
                    setDraftPublished(e.target.checked);
                    setDirty(true);
                  }}
                />
                <span className="text-xs">Published</span>
              </label>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            {selected.published && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {origin}/docs/{selected.slug}
                </span>
                <button className="btn btn-secondary text-xs" onClick={copyPublicUrl}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a
                  href={`/docs/${selected.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-xs"
                >
                  View
                </a>
              </div>
            )}

            {dirty && draftPublished && !selected.published && (
              <p className="text-xs text-muted">
                Save to publish this page and get its public URL.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">
                  Body — # heading, **bold**, *italic*, `code`, [text](url), - list
                </span>
                <textarea
                  className="input min-h-[420px] w-full resize-y font-mono text-sm leading-relaxed"
                  placeholder={"# Getting started\n\nWrite your doc here."}
                  value={draftBody}
                  onChange={(e) => {
                    setDraftBody(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Preview</span>
                <div className="card min-h-[420px] w-full overflow-y-auto p-4 text-sm leading-relaxed">
                  {draftBody.trim() ? (
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <p className="text-muted">
                      Nothing to preview yet. Start typing on the left.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
