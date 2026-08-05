"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Blog = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  tagline: string;
  created_at: string;
};

type BlogPost = {
  id: string;
  blog_id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  published_at: string | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || message.includes("23505")) {
    return "That slug is already taken. Try a different one.";
  }
  return message;
}

export default function BlogPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // Blog settings form
  const [blogSlug, setBlogSlug] = useState("");
  const [blogTitle, setBlogTitle] = useState("My blog");
  const [blogTagline, setBlogTagline] = useState("");
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [blogSaved, setBlogSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Post editor
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setLoading(false);
      setLoadError("You need to be signed in to manage your blog.");
      return;
    }
    setUser(authUser);

    // blogs has BOTH a public select policy and an owner policy, so this MUST
    // filter by user_id — otherwise it would return every user's blog.
    // limit(1) keeps a duplicate row (e.g. a double-submitted create) from
    // making maybeSingle throw and locking the owner out of their own blog.
    const { data: blogRow, error: blogSelectError } = await supabase
      .from("blogs")
      .select("*")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (blogSelectError) {
      setLoadError(blogSelectError.message);
      setLoading(false);
      return;
    }

    if (!blogRow) {
      setBlog(null);
      setPosts([]);
      const suggestion = slugify((authUser.email ?? "").split("@")[0] ?? "");
      setBlogSlug(suggestion);
      setLoading(false);
      return;
    }

    const b = blogRow as Blog;
    setBlog(b);
    setBlogSlug(b.slug);
    setBlogTitle(b.title ?? "My blog");
    setBlogTagline(b.tagline ?? "");

    const { data: postRows, error: postsError } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("blog_id", b.id)
      .order("created_at", { ascending: false });

    if (postsError) {
      setLoadError(postsError.message);
    } else {
      setPosts((postRows ?? []) as BlogPost[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId],
  );

  // Which post the editor is currently holding, and whether it was just created.
  const loadedPostIdRef = useRef<string | null>(null);
  const freshPostIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = selected?.id ?? null;
    // Only reload the editor when the *post* changes. Re-running on every new
    // `posts` object (e.g. after publishing) would throw away unsaved edits.
    if (id === loadedPostIdRef.current) return;
    loadedPostIdRef.current = id;

    if (selected) {
      setDraftTitle(selected.title ?? "");
      setDraftSlug(selected.slug ?? "");
      setDraftBody(selected.body ?? "");
      // A brand-new post has a placeholder slug, so let it keep following the
      // title until the writer edits the slug themselves. Consumed once.
      const isFresh = freshPostIdRef.current === selected.id;
      if (isFresh) freshPostIdRef.current = null;
      setSlugTouched(!isFresh);
    } else {
      setDraftTitle("");
      setDraftSlug("");
      setDraftBody("");
      setSlugTouched(false);
    }
    setDirty(false);
    setPostError(null);
    setCopied(false);
  }, [selected]);

  function selectPost(id: string) {
    if (id === selectedId) return;
    if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
    setSelectedId(id);
  }

  const previewHtml = useMemo(() => renderMarkdownLite(draftBody), [draftBody]);

  async function handleCreateBlog() {
    if (!user) return;
    setBlogError(null);

    const clean = slugify(blogSlug);
    if (!clean) {
      setBlogError("Pick a blog address (letters, numbers, and dashes).");
      return;
    }

    setBlogSaving(true);
    const { data, error } = await supabase
      .from("blogs")
      .insert({
        user_id: user.id,
        slug: clean,
        title: blogTitle.trim() || "My blog",
        tagline: blogTagline.trim(),
      })
      .select()
      .single();

    if (error) {
      setBlogError(friendlyError(error.message));
    } else if (data) {
      const b = data as Blog;
      setBlog(b);
      setBlogSlug(b.slug);
      setBlogTitle(b.title);
      setBlogTagline(b.tagline);
      setPosts([]);
    }
    setBlogSaving(false);
  }

  async function handleSaveBlog() {
    if (!blog || !user) return;
    setBlogError(null);
    setBlogSaved(false);

    const clean = slugify(blogSlug);
    if (!clean) {
      setBlogError("Pick a blog address (letters, numbers, and dashes).");
      return;
    }

    setBlogSaving(true);
    const { data, error } = await supabase
      .from("blogs")
      .update({
        slug: clean,
        title: blogTitle.trim() || "My blog",
        tagline: blogTagline.trim(),
      })
      .eq("id", blog.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      setBlogError(friendlyError(error.message));
    } else if (data) {
      const b = data as Blog;
      setBlog(b);
      setBlogSlug(b.slug);
      setBlogSaved(true);
      setTimeout(() => setBlogSaved(false), 1500);
    }
    setBlogSaving(false);
  }

  async function handleNewPost() {
    if (!blog) return;
    setCreating(true);
    setPostError(null);

    const suffix = Math.random().toString(36).slice(2, 7);
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        blog_id: blog.id,
        slug: `untitled-${suffix}`,
        title: "Untitled",
        body: "",
        published: false,
      })
      .select()
      .single();

    if (error) {
      setPostError(friendlyError(error.message));
    } else if (data) {
      const post = data as BlogPost;
      freshPostIdRef.current = post.id;
      setPosts((prev) => [post, ...prev]);
      setSelectedId(post.id);
    }
    setCreating(false);
  }

  async function handleSavePost() {
    if (!selected || !blog) return;
    setPostError(null);

    const cleanSlug = slugify(draftSlug || draftTitle);
    if (!cleanSlug) {
      setPostError("Please enter a post slug (letters, numbers, and dashes).");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        title: draftTitle.trim() || "Untitled",
        slug: cleanSlug,
        body: draftBody,
      })
      .eq("id", selected.id)
      .eq("blog_id", blog.id)
      .select()
      .single();

    if (error) {
      setPostError(friendlyError(error.message));
    } else if (data) {
      const post = data as BlogPost;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      setDraftSlug(post.slug);
      setDirty(false);
    }
    setSaving(false);
  }

  async function handleTogglePublish() {
    if (!selected || !blog) return;
    setPostError(null);

    const nextPublished = !selected.published;
    const cleanSlug = slugify(draftSlug || draftTitle);
    if (!cleanSlug) {
      setPostError("Please enter a post slug (letters, numbers, and dashes).");
      return;
    }

    setPublishing(true);

    // Publishing pushes whatever is in the editor live. Sending only the flag
    // would publish the last-saved version and silently drop unsaved edits.
    const patch: Record<string, unknown> = {
      title: draftTitle.trim() || "Untitled",
      slug: cleanSlug,
      body: draftBody,
      published: nextPublished,
    };
    // Stamp the publish date the first time this post goes live.
    if (nextPublished && !selected.published_at) {
      patch.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .update(patch)
      .eq("id", selected.id)
      .eq("blog_id", blog.id)
      .select()
      .single();

    if (error) {
      setPostError(friendlyError(error.message));
    } else if (data) {
      const post = data as BlogPost;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      setDraftSlug(post.slug);
      setDirty(false);
    }
    setPublishing(false);
  }

  async function handleDeletePost() {
    if (!selected || !blog) return;
    if (!confirm(`Delete "${selected.title || "Untitled"}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setPostError(null);

    const { error } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", selected.id)
      .eq("blog_id", blog.id);

    if (error) {
      setPostError(error.message);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(null);
    }
    setDeleting(false);
  }

  function copyPostUrl() {
    if (!selected || !blog) return;
    navigator.clipboard
      .writeText(`${origin}/blog/${blog.slug}/${selected.slug}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setPostError("Could not copy to the clipboard."));
  }

  // ---------------------------------------------------------------- loading
  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Loading your blog…</p>
      </div>
    );
  }

  if (loadError && !blog) {
    return (
      <div className="p-6">
        <div className="card mx-auto max-w-md p-6">
          <h1 className="text-lg font-semibold">Blog</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ no blog yet
  if (!blog) {
    return (
      <div className="animate-fade-in p-6">
        <div className="card mx-auto max-w-md p-6">
          <h1 className="text-lg font-semibold">Create your blog</h1>
          <p className="mt-1 text-sm text-muted">
            Pick a public address first. Everything you publish lives under it.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Blog address</span>
              <div className="flex items-center gap-1">
                <span className="shrink-0 text-xs text-muted">/blog/</span>
                <input
                  className="input min-w-0 flex-1 font-mono text-xs"
                  placeholder="your-blog"
                  value={blogSlug}
                  onChange={(e) => setBlogSlug(e.target.value)}
                  onBlur={() => setBlogSlug((s) => slugify(s))}
                />
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Title</span>
              <input
                className="input w-full"
                placeholder="My blog"
                value={blogTitle}
                onChange={(e) => setBlogTitle(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Tagline (optional)</span>
              <input
                className="input w-full"
                placeholder="Notes on shipping software"
                value={blogTagline}
                onChange={(e) => setBlogTagline(e.target.value)}
              />
            </label>

            {blogError && <p className="text-sm text-danger">{blogError}</p>}

            <button
              className="btn btn-primary mt-1"
              onClick={handleCreateBlog}
              disabled={blogSaving}
            >
              {blogSaving ? "Creating…" : "Create blog"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- main editor
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row">
      {/* Sidebar: posts */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-72 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{blog.title}</h1>
            <p className="truncate text-xs text-muted">/blog/{blog.slug}</p>
          </div>
          <button
            className="btn btn-primary shrink-0 text-xs"
            onClick={handleNewPost}
            disabled={creating}
          >
            {creating ? "…" : "+ New"}
          </button>
        </div>

        <div className="flex gap-2 px-4 pb-3">
          <a
            href={`/blog/${blog.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex-1 text-xs"
          >
            View blog
          </a>
          <button
            className="btn btn-secondary flex-1 text-xs"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {settingsOpen ? "Close" : "Settings"}
          </button>
        </div>

        {settingsOpen && (
          <div className="animate-fade-in flex flex-col gap-2 border-y border-border bg-surface/40 px-4 py-3">
            <div className="flex items-center gap-1">
              <span className="shrink-0 text-xs text-muted">/blog/</span>
              <input
                className="input min-w-0 flex-1 font-mono text-xs"
                value={blogSlug}
                onChange={(e) => setBlogSlug(e.target.value)}
                onBlur={() => setBlogSlug((s) => slugify(s))}
              />
            </div>
            <input
              className="input w-full text-sm"
              placeholder="Blog title"
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
            />
            <input
              className="input w-full text-sm"
              placeholder="Tagline"
              value={blogTagline}
              onChange={(e) => setBlogTagline(e.target.value)}
            />
            {blogError && <p className="text-sm text-danger">{blogError}</p>}
            <button
              className="btn btn-secondary text-xs"
              onClick={handleSaveBlog}
              disabled={blogSaving}
            >
              {blogSaving ? "Saving…" : blogSaved ? "Saved!" : "Save blog details"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-2">
              Posts are hosted here under /blog/. No custom domain, RSS feed, or
              email newsletter — changing the address breaks existing links.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {posts.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No posts yet. Hit “+ New” to write your first one — it stays a draft
              until you publish it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {posts.map((post) => (
                <li key={post.id}>
                  <button
                    onClick={() => selectPost(post.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      post.id === selectedId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {post.title || "Untitled"}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                          post.published
                            ? "border-accent text-accent"
                            : "border-border text-muted"
                        }`}
                      >
                        {post.published ? "live" : "draft"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">/{post.slug}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(post.published_at ?? post.created_at)}
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
            <p className="max-w-sm text-sm text-muted">
              {loadError ??
                "Select a post on the left, or create a new one. Drafts stay private until you publish them."}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                className="input min-w-0 flex-1 text-base font-medium"
                placeholder="Post title"
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
                  onClick={handleSavePost}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={handleTogglePublish}
                  disabled={publishing}
                >
                  {publishing
                    ? "…"
                    : selected.published
                      ? "Unpublish"
                      : "Publish"}
                </button>
                <button
                  className="btn btn-secondary text-xs text-danger"
                  onClick={handleDeletePost}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[18rem] flex-1 items-center gap-1">
                <span className="shrink-0 text-xs text-muted">
                  /blog/{blog.slug}/
                </span>
                <input
                  className="input min-w-0 flex-1 font-mono text-xs"
                  placeholder="post-slug"
                  value={draftSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setDraftSlug(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={() => setDraftSlug((s) => slugify(s))}
                />
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                  selected.published
                    ? "border-accent text-accent"
                    : "border-border text-muted"
                }`}
              >
                {selected.published ? "Published" : "Draft"}
              </span>
              {selected.published_at && (
                <span className="text-xs text-muted">
                  First published {formatDate(selected.published_at)}
                </span>
              )}
            </div>

            {postError && <p className="text-sm text-danger">{postError}</p>}

            {selected.published ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {origin}/blog/{blog.slug}/{selected.slug}
                </span>
                <button className="btn btn-secondary text-xs" onClick={copyPostUrl}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a
                  href={`/blog/${blog.slug}/${selected.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-xs"
                >
                  View
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted">
                This post is a draft — nobody else can see it. Hit Publish to put it
                live at {origin}/blog/{blog.slug}/{slugify(draftSlug || draftTitle) || "post-slug"}.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">
                  Body — # heading, **bold**, *italic*, `code`, [text](url), - list
                </span>
                <textarea
                  className="input min-h-[420px] w-full resize-y font-mono text-sm leading-relaxed"
                  placeholder={"# Hello world\n\nWrite your post here."}
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
