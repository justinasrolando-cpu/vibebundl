"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ColumnName = "todo" | "doing" | "done";

type Card = {
  id: string;
  user_id: string;
  board: string;
  title: string;
  description: string;
  column_name: ColumnName;
  position: number;
  created_at: string;
};

const COLUMNS: ColumnName[] = ["todo", "doing", "done"];

const COLUMN_LABEL: Record<ColumnName, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

const COLUMN_DOT: Record<ColumnName, string> = {
  todo: "bg-muted",
  doing: "bg-accent",
  done: "bg-foreground",
};

const COLUMN_EMPTY: Record<ColumnName, string> = {
  todo: "Nothing queued up. Add a card with + Card above.",
  doing: "Nothing in progress. Move a card here when you start it.",
  done: "Nothing finished yet. Move cards here as you wrap them up.",
};

const DEFAULT_BOARD = "Default";

function sortCards(list: Card[]): Card[] {
  return [...list].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function KanbanPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeBoard, setActiveBoard] = useState<string>(DEFAULT_BOARD);
  // Boards the user just created that have no cards yet (not yet persisted).
  const [draftBoards, setDraftBoards] = useState<string[]>([]);
  const [newBoard, setNewBoard] = useState("");

  // Per-column quick add
  const [addingColumn, setAddingColumn] = useState<ColumnName | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnName | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCards = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("kanban_cards")
        .select("*")
        .eq("user_id", uid)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        const rows = data as Card[];
        setError(null);
        setCards(rows);
        // Land on a board that actually has cards, if the default one is empty.
        if (rows.length > 0 && !rows.some((c) => (c.board || DEFAULT_BOARD) === DEFAULT_BOARD)) {
          setActiveBoard(sortCards(rows)[0].board || DEFAULT_BOARD);
        }
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
        setError("You need to be signed in to use the board.");
        return;
      }
      setUserId(user.id);
      await loadCards(user.id);
    })();
  }, [supabase, loadCards]);

  const boards = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => set.add(c.board || DEFAULT_BOARD));
    draftBoards.forEach((b) => set.add(b));
    if (set.size === 0) set.add(DEFAULT_BOARD);
    set.add(activeBoard);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards, draftBoards, activeBoard]);

  const boardCards = useMemo(
    () => cards.filter((c) => (c.board || DEFAULT_BOARD) === activeBoard),
    [cards, activeBoard],
  );

  const columns = useMemo(() => {
    const map: Record<ColumnName, Card[]> = { todo: [], doing: [], done: [] };
    for (const card of boardCards) {
      (map[card.column_name] ?? map.todo).push(card);
    }
    (Object.keys(map) as ColumnName[]).forEach((key) => {
      map[key] = sortCards(map[key]);
    });
    return map;
  }, [boardCards]);

  const countForBoard = useCallback(
    (board: string) => cards.filter((c) => (c.board || DEFAULT_BOARD) === board).length,
    [cards],
  );

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBoard.trim();
    if (!name) return;
    setDraftBoards((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveBoard(name);
    setNewBoard("");
    setError(null);
  };

  const startAdd = (column: ColumnName) => {
    setAddingColumn(column);
    setNewTitle("");
    setError(null);
  };

  const handleAdd = async (e: React.FormEvent, column: ColumnName) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (!userId) {
      setError("You are signed out. Sign in again to add cards.");
      return;
    }
    setSavingAdd(true);
    setError(null);
    const existing = columns[column];
    const position = existing.length ? Math.max(...existing.map((c) => c.position)) + 1 : 0;
    const { data, error: insertError } = await supabase
      .from("kanban_cards")
      .insert({
        user_id: userId,
        board: activeBoard,
        title,
        description: "",
        column_name: column,
        position,
      })
      .select()
      .single();
    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setCards((prev) => [...prev, data as Card]);
      setDraftBoards((prev) => prev.filter((b) => b !== activeBoard));
      setNewTitle("");
      setAddingColumn(null);
    }
    setSavingAdd(false);
  };

  const startEdit = (card: Card) => {
    setEditingId(card.id);
    setDraftTitle(card.title);
    setDraftDescription(card.description ?? "");
    setError(null);
  };

  const handleSaveEdit = async (card: Card) => {
    const title = draftTitle.trim();
    if (!title) {
      setError("A card needs a title.");
      return;
    }
    setSavingEdit(true);
    setError(null);
    const description = draftDescription.trim();
    const { data, error: updateError } = await supabase
      .from("kanban_cards")
      .update({ title, description })
      .eq("id", card.id)
      .select()
      .single();
    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      setCards((prev) => prev.map((c) => (c.id === card.id ? (data as Card) : c)));
      setEditingId(null);
    }
    setSavingEdit(false);
  };

  const handleDelete = async (card: Card) => {
    if (!confirm(`Delete "${card.title}"? This cannot be undone.`)) return;
    const snapshot = cards;
    setBusyId(card.id);
    setError(null);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    const { error: deleteError } = await supabase.from("kanban_cards").delete().eq("id", card.id);
    if (deleteError) {
      setCards(snapshot);
      setError(deleteError.message);
    } else if (editingId === card.id) {
      setEditingId(null);
    }
    setBusyId(null);
  };

  /** Move a card up or down within its column by rewriting positions. */
  const handleReorder = async (card: Card, direction: -1 | 1) => {
    const list = columns[card.column_name];
    const index = list.findIndex((c) => c.id === card.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= list.length) return;

    const reordered = [...list];
    const moved = reordered[index];
    reordered[index] = reordered[target];
    reordered[target] = moved;

    const repositioned = reordered.map((c, i) => ({ ...c, position: i }));
    const changed = repositioned.filter((c) => {
      const original = list.find((o) => o.id === c.id);
      return original ? original.position !== c.position : false;
    });
    if (changed.length === 0) return;

    const snapshot = cards;
    setBusyId(card.id);
    setError(null);
    setCards((prev) => prev.map((c) => repositioned.find((r) => r.id === c.id) ?? c));

    const results = await Promise.all(
      changed.map((c) =>
        supabase.from("kanban_cards").update({ position: c.position }).eq("id", c.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setCards(snapshot);
      setError(failed.error.message);
    }
    setBusyId(null);
  };

  /** Move a card to another column, appended at the end. */
  const moveCardToColumn = async (card: Card, column: ColumnName) => {
    if (card.column_name === column) return;

    const target = columns[column];
    const position = target.length ? Math.max(...target.map((c) => c.position)) + 1 : 0;

    const snapshot = cards;
    setBusyId(card.id);
    setError(null);
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, column_name: column, position } : c)),
    );
    const { error: moveError } = await supabase
      .from("kanban_cards")
      .update({ column_name: column, position })
      .eq("id", card.id);
    if (moveError) {
      setCards(snapshot);
      setError(moveError.message);
    }
    setBusyId(null);
  };

  const handleDropOnColumn = (column: ColumnName) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverColumn(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    void moveCardToColumn(card, column);
  };

  return (
    <div className="flex h-screen flex-col p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Kanban Board</h1>
          <p className="mt-1 text-sm text-muted">
            {boardCards.length} card{boardCards.length === 1 ? "" : "s"} on{" "}
            <span className="text-foreground">{activeBoard}</span> · drag cards between columns, or
            use ← → on a card
          </p>
        </div>
        <form onSubmit={handleCreateBoard} className="flex items-center gap-2">
          <input
            className="input w-44 text-sm"
            placeholder="New board name…"
            value={newBoard}
            onChange={(e) => setNewBoard(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary text-xs" disabled={!newBoard.trim()}>
            + Board
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {boards.map((board) => (
          <button
            key={board}
            type="button"
            onClick={() => {
              setActiveBoard(board);
              setAddingColumn(null);
              setEditingId(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              board === activeBoard
                ? "border-accent text-accent"
                : "border-border text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {board}
            <span className="ml-1.5 opacity-60">{countForBoard(board)}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading board…</p>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((column, columnIndex) => (
            <div
              key={column}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverColumn !== column) setDragOverColumn(column);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setDragOverColumn((prev) => (prev === column ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnColumn(column);
              }}
              className={`flex min-h-0 flex-col rounded-lg border bg-surface/30 transition-colors ${
                dragOverColumn === column ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[column]}`} />
                <h2 className="text-sm font-medium">{COLUMN_LABEL[column]}</h2>
                <span className="text-xs text-muted">({columns[column].length})</span>
                <button
                  type="button"
                  className="ml-auto rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  onClick={() => (addingColumn === column ? setAddingColumn(null) : startAdd(column))}
                >
                  {addingColumn === column ? "Cancel" : "+ Card"}
                </button>
              </div>

              {addingColumn === column && (
                <form
                  onSubmit={(e) => handleAdd(e, column)}
                  className="animate-fade-in flex gap-2 border-b border-border p-2"
                >
                  <input
                    autoFocus
                    className="input w-full text-sm"
                    placeholder={`Add to ${COLUMN_LABEL[column]}…`}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary shrink-0 text-xs"
                    disabled={savingAdd || !newTitle.trim()}
                  >
                    {savingAdd ? "Adding…" : "Add"}
                  </button>
                </form>
              )}

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {columns[column].length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted">{COLUMN_EMPTY[column]}</p>
                ) : (
                  columns[column].map((card, index) => {
                    const isEditing = editingId === card.id;
                    return (
                      <div
                        key={card.id}
                        draggable={!isEditing}
                        onDragStart={(e) => {
                          setDraggingId(card.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", card.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverColumn(null);
                        }}
                        className={`card animate-fade-in flex flex-col gap-2 p-3 ${
                          draggingId === card.id ? "opacity-50" : ""
                        } ${isEditing ? "" : "cursor-grab active:cursor-grabbing"}`}
                      >
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              className="input w-full text-sm"
                              placeholder="Card title"
                              value={draftTitle}
                              onChange={(e) => setDraftTitle(e.target.value)}
                            />
                            <textarea
                              className="input min-h-[70px] w-full resize-y text-xs"
                              placeholder="Description (optional)"
                              value={draftDescription}
                              onChange={(e) => setDraftDescription(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary text-xs"
                                onClick={() => setEditingId(null)}
                                disabled={savingEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary text-xs"
                                onClick={() => handleSaveEdit(card)}
                                disabled={savingEdit || !draftTitle.trim()}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 break-words text-sm">{card.title}</p>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Move to ${COLUMN_LABEL[COLUMNS[columnIndex - 1] ?? column]}`}
                                  title={
                                    columnIndex > 0
                                      ? `Move to ${COLUMN_LABEL[COLUMNS[columnIndex - 1]]}`
                                      : undefined
                                  }
                                  className="rounded-md px-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                                  disabled={columnIndex === 0 || busyId === card.id}
                                  onClick={() => moveCardToColumn(card, COLUMNS[columnIndex - 1])}
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move to ${COLUMN_LABEL[COLUMNS[columnIndex + 1] ?? column]}`}
                                  title={
                                    columnIndex < COLUMNS.length - 1
                                      ? `Move to ${COLUMN_LABEL[COLUMNS[columnIndex + 1]]}`
                                      : undefined
                                  }
                                  className="rounded-md px-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                                  disabled={columnIndex === COLUMNS.length - 1 || busyId === card.id}
                                  onClick={() => moveCardToColumn(card, COLUMNS[columnIndex + 1])}
                                >
                                  →
                                </button>
                                <span className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />
                                <button
                                  type="button"
                                  aria-label="Move up"
                                  title="Move up"
                                  className="rounded-md px-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                                  disabled={index === 0 || busyId === card.id}
                                  onClick={() => handleReorder(card, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  aria-label="Move down"
                                  title="Move down"
                                  className="rounded-md px-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                                  disabled={index === columns[column].length - 1 || busyId === card.id}
                                  onClick={() => handleReorder(card, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                            {card.description && (
                              <p className="whitespace-pre-wrap text-xs text-muted">{card.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-xs text-muted transition-colors hover:text-foreground"
                                onClick={() => startEdit(card)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-xs text-muted transition-colors hover:text-danger"
                                onClick={() => handleDelete(card)}
                                disabled={busyId === card.id}
                              >
                                Delete
                              </button>
                              {busyId === card.id && <span className="text-xs text-muted">Saving…</span>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="mt-3 text-xs text-muted">
          Nothing on any board yet. Add a card to a column above, or create a second board to keep
          projects apart.
        </p>
      )}
    </div>
  );
}
