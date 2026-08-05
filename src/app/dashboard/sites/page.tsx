"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type BlockType = "heading" | "paragraph" | "image" | "button";

type Block = {
  id: string;
  type: BlockType;
  content: string;
  url?: string;
};

type Site = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  blocks: Block[];
  published: boolean;
  created_at: string;
};

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  button: "Button",
};

function newBlockId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SiteBuilderPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [site, setSite] = useState<Site | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [newBlockType, setNewBlockType] = useState<BlockType>("heading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setUser(authUser);

      // limit(1) rather than maybeSingle(): maybeSingle() throws if a second
      // row ever exists, which would blank the whole builder.
      const { data: siteRows, error: fetchError } = await supabase
        .from("sites")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;

      if (fetchError) {
        setError("Couldn't load your site. Refresh the page to try again.");
      }

      const siteRow = siteRows?.[0];
      if (siteRow) {
        const s = siteRow as Site;
        setSite(s);
        setSlug(s.slug);
        setTitle(s.title);
        setBlocks(Array.isArray(s.blocks) ? s.blocks : []);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const cleanSlug = slugify(slug);
    const cleanTitle = title.trim();
    if (!cleanSlug) {
      setError("Please enter a valid slug (letters, numbers, dashes).");
      return;
    }
    if (!cleanTitle) {
      setError("Please enter a title.");
      return;
    }

    setSavingMeta(true);
    try {
      if (site) {
        const { data, error: updateError } = await supabase
          .from("sites")
          .update({ slug: cleanSlug, title: cleanTitle })
          .eq("id", site.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          setError(
            updateError.code === "23505"
              ? `The slug "${cleanSlug}" is already taken. Try another one.`
              : updateError.message,
          );
          return;
        }
        setSite(data as Site);
        setSlug(cleanSlug);
        setTitle(cleanTitle);
        setEditingMeta(false);
      } else {
        const { data, error: insertError } = await supabase
          .from("sites")
          .insert({
            user_id: user.id,
            slug: cleanSlug,
            title: cleanTitle,
            blocks: [],
            published: false,
          })
          .select()
          .single();

        if (insertError) {
          setError(
            insertError.code === "23505"
              ? `The slug "${cleanSlug}" is already taken. Try another one.`
              : insertError.message,
          );
          return;
        }
        setSite(data as Site);
        setSlug(cleanSlug);
        setTitle(cleanTitle);
        setBlocks([]);
      }
    } finally {
      setSavingMeta(false);
    }
  }

  async function persistBlocks(nextBlocks: Block[]) {
    if (!site) return;
    setBlocks(nextBlocks);
    setSavingBlocks(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("sites")
        .update({ blocks: nextBlocks })
        .eq("id", site.id);

      if (updateError) {
        setError(updateError.message);
      }
    } finally {
      setSavingBlocks(false);
    }
  }

  function addBlock() {
    const block: Block = {
      id: newBlockId(),
      type: newBlockType,
      content: "",
      ...(newBlockType === "button" ? { url: "" } : {}),
    };
    void persistBlocks([...blocks, block]);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
    setBlocks(next);
  }

  function commitBlock() {
    void persistBlocks(blocks);
  }

  function removeBlock(id: string) {
    void persistBlocks(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    void persistBlocks(next);
  }

  async function togglePublished() {
    if (!site) return;
    setTogglingPublish(true);
    setError(null);
    const nextPublished = !site.published;
    try {
      const { data, error: updateError } = await supabase
        .from("sites")
        .update({ published: nextPublished })
        .eq("id", site.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSite(data as Site);
    } finally {
      setTogglingPublish(false);
    }
  }

  async function copyPublicUrl() {
    if (!site) return;
    const publicUrl = `${window.location.origin}/s/${site.slug}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to the clipboard — select the URL and copy it manually.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 md:p-8">
      <h1 className="text-lg font-semibold">Site Builder</h1>
      <p className="mt-1 text-sm text-muted">
        Publish a simple one-page site from content blocks. One site per account, hosted at a
        vibebundl.com URL — custom domains aren&apos;t supported.
      </p>

      {!site || editingMeta ? (
        <div className="card mt-6 max-w-lg p-4">
          <h2 className="text-sm font-medium">
            {site ? "Edit site" : "Create your site"}
          </h2>
          <form onSubmit={saveMeta} className="mt-3 flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted">Slug (your public URL)</label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-muted">/s/</span>
                <input
                  className="input flex-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-site"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted">Title</label>
              <input
                className="input mt-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Site"
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" disabled={savingMeta} className="btn btn-primary">
                {savingMeta ? "Saving…" : site ? "Save changes" : "Create site"}
              </button>
              {site && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingMeta(false);
                    setSlug(site.slug);
                    setTitle(site.title);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="card animate-fade-in mt-6 max-w-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{site.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">/s/{site.slug}</p>
            </div>
            <button
              className="btn btn-secondary shrink-0 text-xs"
              onClick={() => setEditingMeta(true)}
            >
              Edit
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
            <div>
              <p className="text-xs font-medium">
                {site.published ? "Published" : "Unpublished"}
              </p>
              <p className="text-xs text-muted">
                Only live at the public URL while this is on.
              </p>
            </div>
            <button
              className="btn btn-secondary text-xs"
              disabled={togglingPublish}
              onClick={togglePublished}
            >
              {togglingPublish
                ? "…"
                : site.published
                  ? "Unpublish"
                  : "Publish"}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <span className="flex-1 truncate text-xs text-muted">
              {typeof window !== "undefined" ? window.location.origin : ""}/s/{site.slug}
            </span>
            <button className="btn btn-secondary text-xs" onClick={copyPublicUrl}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={`/s/${site.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-xs"
            >
              View
            </a>
          </div>
        </div>
      )}

      {site && (
        <div className="mt-8 max-w-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Blocks</h2>
            {savingBlocks && <span className="text-xs text-muted">Saving…</span>}
          </div>

          <div className="card mt-3 flex items-center gap-2 p-4">
            <select
              className="input flex-1"
              value={newBlockType}
              onChange={(e) => setNewBlockType(e.target.value as BlockType)}
            >
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary shrink-0" onClick={addBlock}>
              Add block
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <div className="mt-4 flex flex-col gap-2">
            {blocks.length === 0 ? (
              <p className="text-sm text-muted">
                No blocks yet. Add a heading, paragraph, image, or button above to start
                building your page.
              </p>
            ) : (
              blocks.map((block, index) => (
                <div key={block.id} className="card animate-fade-in flex gap-3 p-3">
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      className="rounded text-muted transition-colors hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="rounded text-muted transition-colors hover:text-foreground disabled:opacity-30"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted">
                      {BLOCK_LABELS[block.type]}
                    </p>

                    {block.type === "paragraph" ? (
                      <textarea
                        className="input mt-1.5 w-full resize-none"
                        rows={3}
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(block.id, { content: e.target.value })
                        }
                        onBlur={commitBlock}
                        placeholder="Paragraph text"
                      />
                    ) : block.type === "heading" ? (
                      <input
                        className="input mt-1.5 w-full"
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(block.id, { content: e.target.value })
                        }
                        onBlur={commitBlock}
                        placeholder="Heading text"
                      />
                    ) : block.type === "image" ? (
                      <input
                        className="input mt-1.5 w-full"
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(block.id, { content: e.target.value })
                        }
                        onBlur={commitBlock}
                        placeholder="https://example.com/image.jpg"
                      />
                    ) : (
                      <div className="mt-1.5 flex flex-col gap-2">
                        <input
                          className="input w-full"
                          value={block.content}
                          onChange={(e) =>
                            updateBlock(block.id, { content: e.target.value })
                          }
                          onBlur={commitBlock}
                          placeholder="Button label"
                        />
                        <input
                          className="input w-full"
                          value={block.url ?? ""}
                          onChange={(e) =>
                            updateBlock(block.id, { url: e.target.value })
                          }
                          onBlur={commitBlock}
                          placeholder="https://example.com"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-secondary shrink-0 self-start text-xs text-danger"
                    onClick={() => removeBlock(block.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
