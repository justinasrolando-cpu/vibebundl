"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Board = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  created_at: string;
};

type Post = {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  status: "open" | "planned" | "in_progress" | "done";
  votes: number;
  created_at: string;
};

const STATUS_OPTIONS: Post["status"][] = ["open", "planned", "in_progress", "done"];

const STATUS_LABEL: Record<Post["status"], string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function FeedbackPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // board form state
  const [editingBoard, setEditingBoard] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadBoard(ownerId?: string | null) {
    setLoading(true);
    setError(null);

    const uid = ownerId ?? userId;
    if (!uid) {
      setBoard(null);
      setPosts([]);
      setError("You are signed out. Sign in again to manage your board.");
      setLoading(false);
      return;
    }

    // NOTE: feedback_boards has BOTH a public select policy and an owner policy,
    // so the user_id filter is required — RLS alone returns every user's rows.
    // limit(1) rather than a bare maybeSingle(): maybeSingle throws if a user
    // somehow ends up with two boards, which would brick the whole page.
    const { data: boardRows, error: boardError } = await supabase
      .from("feedback_boards")
      .select("id, user_id, slug, title, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1);

    if (boardError) {
      setError(boardError.message);
      setLoading(false);
      return;
    }

    const boardData = (boardRows?.[0] ?? null) as Board | null;
    setBoard(boardData);

    if (boardData) {
      const { data: postsData, error: postsError } = await supabase
        .from("feedback_posts")
        .select("id, board_id, title, description, status, votes, created_at")
        .eq("board_id", boardData.id)
        .order("votes", { ascending: false });

      if (postsError) {
        setError(postsError.message);
        setLoading(false);
        return;
      }

      setPosts((postsData ?? []) as Post[]);
    } else {
      setPosts([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadBoard(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function startEditBoard() {
    if (board) {
      setSlug(board.slug);
      setSlugTouched(true);
      setTitle(board.title);
    }
    setEditingBoard(true);
  }

  async function handleBoardSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    setSaving(true);

    if (board) {
      const { error: updateError } = await supabase
        .from("feedback_boards")
        .update({ slug: cleanSlug, title: title.trim() })
        .eq("id", board.id);

      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "That slug is already taken."
            : updateError.message,
        );
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("feedback_boards").insert({
        user_id: userId,
        slug: cleanSlug,
        title: title.trim(),
      });

      if (insertError) {
        setError(
          insertError.code === "23505"
            ? "That slug is already taken."
            : insertError.message,
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setEditingBoard(false);
    setSlugTouched(false);
    await loadBoard();
  }

  async function handleStatusChange(post: Post, status: Post["status"]) {
    setUpdatingId(post.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("feedback_posts")
      .update({ status })
      .eq("id", post.id);

    if (updateError) {
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, status } : p)),
    );
    setUpdatingId(null);
  }

  async function handleDelete(post: Post) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    setDeletingId(post.id);
    setError(null);

    const { error: deleteError } = await supabase
      .from("feedback_posts")
      .delete()
      .eq("id", post.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setDeletingId(null);
  }

  const publicOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Feedback Board</h1>
      <p className="mt-1 text-sm text-muted">
        Collect feature requests from a public board, prioritize with votes, track status.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : !board && !editingBoard ? (
        <div className="card animate-fade-in mt-6 p-4 text-sm text-muted">
          No board yet. Create one to get a public feedback page your users can
          post ideas on and upvote.
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditingBoard(true)}
            >
              Create board
            </button>
          </div>
        </div>
      ) : editingBoard ? (
        <form
          onSubmit={handleBoardSubmit}
          className="card animate-fade-in mt-6 flex flex-col gap-3 p-4"
        >
          <p className="text-sm font-medium">{board ? "Edit board" : "New board"}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Product Feedback"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted" htmlFor="slug">
                Slug
              </label>
              <input
                id="slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="product-feedback"
                required
              />
            </div>
          </div>

          {slug && (
            <p className="text-xs text-muted">
              Public URL:{" "}
              <span className="text-foreground">
                {publicOrigin}/b/{slugify(slug)}
              </span>
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : board ? "Save changes" : "Create board"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditingBoard(false);
                setSlugTouched(false);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        board && (
          <div className="card animate-fade-in mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{board.title}</p>
              <p className="truncate text-xs text-muted">
                {publicOrigin}/b/{board.slug} · {posts.length}{" "}
                {posts.length === 1 ? "post" : "posts"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Vote counts are read when this page loads — hit Refresh to pull
                the latest.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/b/${board.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                View
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => loadBoard()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={startEditBoard}
              >
                Edit
              </button>
            </div>
          </div>
        )
      )}

      {board && !editingBoard && (
        <div className="mt-6 flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}

          {posts.length === 0 ? (
            <div className="card p-4 text-sm text-muted">
              No feedback yet. Share your public board URL to start collecting ideas.
            </div>
          ) : (
            posts.map((post, i) => (
              <div
                key={post.id}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                className="card animate-fade-in flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-muted">
                      {post.votes} {post.votes === 1 ? "vote" : "votes"}
                    </span>
                    <p className="truncate text-sm font-medium">{post.title}</p>
                  </div>
                  {post.description && (
                    <p className="mt-1 text-xs text-muted">{post.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className="input"
                    value={post.status}
                    disabled={updatingId === post.id}
                    onChange={(e) =>
                      handleStatusChange(post, e.target.value as Post["status"])
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary text-danger"
                    onClick={() => handleDelete(post)}
                    disabled={deletingId === post.id}
                  >
                    {deletingId === post.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
