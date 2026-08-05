"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
};

type Board = {
  id: string;
  user_id: string;
  title: string;
  notes: Note[];
  updated_at: string;
  created_at: string;
};

const COLORS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
];

const DEFAULT_NOTE_SIZE = { width: 200, height: 160 };
const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 2200;

function newNoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type DragState =
  | {
      kind: "move";
      noteId: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      origX: number;
      origY: number;
      width: number;
      height: number;
    }
  | {
      kind: "resize";
      noteId: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      origWidth: number;
      origHeight: number;
    };

export default function WhiteboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Editable draft state for the selected board
  const [draftTitle, setDraftTitle] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [dirty, setDirty] = useState(false);

  const dragRef = useRef<DragState | null>(null);

  const loadBoards = useCallback(
    async (uid: string) => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("whiteboard_boards")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setBoards((data ?? []) as Board[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoadError("You need to be signed in to use boards.");
        return;
      }
      setUserId(user.id);
      await loadBoards(user.id);
    })();
  }, [supabase, loadBoards]);

  // Warn before losing unsaved note changes on refresh/close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const selectedBoard = useMemo(
    () => boards.find((b) => b.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  useEffect(() => {
    if (selectedBoard) {
      setDraftTitle(selectedBoard.title || "Untitled board");
      setNotes(
        Array.isArray(selectedBoard.notes)
          ? selectedBoard.notes.map((n) => ({ ...n }))
          : [],
      );
      setDirty(false);
    } else {
      setDraftTitle("");
      setNotes([]);
      setDirty(false);
    }
  }, [selectedBoard]);

  const selectBoard = (id: string) => {
    if (id === selectedBoardId) return;
    if (dirty && !confirm("This board has unsaved changes. Switch boards and discard them?")) return;
    setActionError(null);
    setSelectedBoardId(id);
  };

  const handleNewBoard = async () => {
    if (!userId || creating) return;
    if (dirty && !confirm("This board has unsaved changes. Create a new board and discard them?")) return;
    setActionError(null);
    setCreating(true);
    const { data, error } = await supabase
      .from("whiteboard_boards")
      .insert({ user_id: userId, title: "Untitled board", notes: [] })
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not create the board.");
    } else {
      setBoards((prev) => [data as Board, ...prev]);
      setSelectedBoardId((data as Board).id);
    }
    setCreating(false);
  };

  const handleDeleteBoard = async () => {
    if (!selectedBoard || !userId || deleting) return;
    if (!confirm(`Delete "${selectedBoard.title || "Untitled board"}"? This cannot be undone.`)) return;
    setActionError(null);
    setDeleting(true);
    const id = selectedBoard.id;
    const { error } = await supabase
      .from("whiteboard_boards")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      setActionError(error.message);
    } else {
      setDirty(false);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setSelectedBoardId(null);
    }
    setDeleting(false);
  };

  const handleSave = useCallback(async () => {
    if (!selectedBoard || !userId) return;
    setActionError(null);
    setSaving(true);
    const title = draftTitle.trim() || "Untitled board";
    const { data, error } = await supabase
      .from("whiteboard_boards")
      .update({ title, notes, updated_at: new Date().toISOString() })
      .eq("id", selectedBoard.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not save the board.");
    } else {
      setBoards((prev) =>
        [...prev.map((b) => (b.id === selectedBoard.id ? (data as Board) : b))].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      );
      setDirty(false);
    }
    setSaving(false);
  }, [supabase, selectedBoard, userId, draftTitle, notes]);

  const handleAddNote = () => {
    const count = notes.length;
    const offset = (count % 8) * 24;
    const note: Note = {
      id: newNoteId(),
      x: 40 + offset,
      y: 40 + offset,
      width: DEFAULT_NOTE_SIZE.width,
      height: DEFAULT_NOTE_SIZE.height,
      color: COLORS[count % COLORS.length].value,
      text: "",
    };
    setNotes((prev) => [...prev, note]);
    setDirty(true);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setDirty(true);
  };

  const updateNote = (id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  // --- Drag / resize via pointer events ---

  const handleHeaderPointerDown = (e: React.PointerEvent, note: Note) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      noteId: note.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: note.x,
      origY: note.y,
      width: note.width,
      height: note.height,
    };
  };

  const handleResizePointerDown = (e: React.PointerEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      noteId: note.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origWidth: note.width,
      origHeight: note.height,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (drag.kind === "move") {
      // Clamp inside the canvas so a note can never be dragged out of reach.
      const nextX = Math.min(Math.max(0, drag.origX + dx), CANVAS_WIDTH - drag.width);
      const nextY = Math.min(Math.max(0, drag.origY + dy), CANVAS_HEIGHT - drag.height);
      updateNote(drag.noteId, { x: nextX, y: nextY });
    } else {
      const nextWidth = Math.max(140, Math.min(drag.origWidth + dx, CANVAS_WIDTH));
      const nextHeight = Math.max(100, Math.min(drag.origHeight + dy, CANVAS_HEIGHT));
      updateNote(drag.noteId, { width: nextWidth, height: nextHeight });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDirty(true);
  };

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left pane: board list */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-72 md:shrink-0 md:border-b-0 md:border-r">
        <div className="p-4 pb-3">
          <h1 className="text-lg font-semibold">Sticky Note Board</h1>
          <p className="mt-0.5 text-xs text-muted">
            Sticky notes only — no freehand drawing or shapes.
          </p>
        </div>
        <div className="px-4 pb-3">
          <button
            className="btn btn-primary w-full text-xs"
            onClick={handleNewBoard}
            disabled={creating || !userId}
          >
            {creating ? "Creating…" : "+ New board"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p className="px-2 py-4 text-sm text-danger">{loadError}</p>
          ) : boards.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No boards yet. Create your first board to start sticking notes.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    onClick={() => selectBoard(board.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      board.id === selectedBoardId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{board.title || "Untitled board"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted">{formatDate(board.updated_at)}</span>
                      <span className="text-xs text-muted">
                        {Array.isArray(board.notes) ? board.notes.length : 0} note
                        {Array.isArray(board.notes) && board.notes.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right pane: board canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedBoard ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="card max-w-sm p-8">
              <p className="text-sm text-muted">
                Select a board on the left, or create a new one to start sticking notes.
              </p>
              {actionError && <p className="mt-3 text-sm text-danger">{actionError}</p>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className="input min-w-0 text-base font-medium"
                  placeholder="Board title"
                  value={draftTitle}
                  onChange={(e) => {
                    setDraftTitle(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}</span>
                <button className="btn btn-secondary text-xs" onClick={handleAddNote}>
                  + Add note
                </button>
                <button
                  className="btn btn-primary text-xs"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                >
                  Save
                </button>
                <button
                  className="btn btn-secondary text-xs text-danger"
                  onClick={handleDeleteBoard}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            {actionError && (
              <p className="border-b border-border px-4 py-2 text-sm text-danger">{actionError}</p>
            )}

            <div className="relative flex-1 overflow-auto bg-surface/30">
              <div
                className="relative"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  backgroundImage:
                    "radial-gradient(circle, var(--color-border, #2a2a2a) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {notes.length === 0 && (
                  <p className="absolute left-4 top-4 text-sm text-muted">
                    No notes yet. Click &ldquo;+ Add note&rdquo; to place your first sticky, then hit
                    Save — changes are not saved automatically.
                  </p>
                )}
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="absolute flex flex-col overflow-hidden rounded-md shadow-md"
                    style={{
                      left: note.x,
                      top: note.y,
                      width: note.width,
                      height: note.height,
                      backgroundColor: note.color,
                    }}
                  >
                    <div
                      className="flex shrink-0 cursor-grab items-center justify-between gap-1 px-2 py-1 active:cursor-grabbing"
                      onPointerDown={(e) => handleHeaderPointerDown(e, note)}
                    >
                      <div className="flex items-center gap-1">
                        {COLORS.map((c) => (
                          <button
                            key={c.value}
                            title={c.name}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => {
                              updateNote(note.id, { color: c.value });
                              setDirty(true);
                            }}
                            className="h-3.5 w-3.5 shrink-0 rounded-full border"
                            style={{
                              backgroundColor: c.value,
                              borderColor: note.color === c.value ? "#000" : "rgba(0,0,0,0.25)",
                              borderWidth: note.color === c.value ? 2 : 1,
                            }}
                          />
                        ))}
                      </div>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleDeleteNote(note.id)}
                        className="shrink-0 rounded px-1 text-xs font-semibold text-black/60 hover:bg-black/10 hover:text-black"
                        title="Delete note"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={note.text}
                      onChange={(e) => {
                        updateNote(note.id, { text: e.target.value });
                        setDirty(true);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder="Type something…"
                      className="flex-1 resize-none border-0 bg-transparent p-2 text-sm text-black/80 outline-none placeholder:text-black/40"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, note)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
                      style={{
                        background:
                          "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.25) 50%)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
