"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tags: string[] | null;
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

// Small local markdown-ish renderer: headings, bold, italic, line breaks.
// Input is escaped first so no raw HTML can be injected.
function renderMarkdownLite(input: string): string {
  const escaped = escapeHtml(input);

  const lines = escaped.split("\n").map((line) => {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      return `<h${level + 2} class="mt-2 mb-1 font-semibold">${heading[2]}</h${level + 2}>`;
    }
    return line;
  });

  let html = lines.join("\n");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  html = html
    .split("\n")
    .map((line) => (line.startsWith("<h") ? line : line.length ? `<p>${line}</p>` : "<br/>"))
    .join("");

  return html;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Editor draft state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [dirty, setDirty] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which note the editor draft currently belongs to. Used so that refreshing
  // the notes list (e.g. after a save) never clobbers what the user is typing.
  const loadedDraftId = useRef<string | null>(null);

  const loadNotes = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setNotes((data ?? []) as Note[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setLoadError("You are signed out. Sign in again to see your notes.");
        setLoading(false);
        return;
      }
      await loadNotes(user.id);
    })();
  }, [supabase, loadNotes]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // Sync editor draft only when the *selected note* changes — not on every
  // refresh of the notes array, which would overwrite in-flight typing.
  useEffect(() => {
    if (loadedDraftId.current === selectedId) return;
    loadedDraftId.current = selectedId;
    const note = notes.find((n) => n.id === selectedId) ?? null;
    setDraftTitle(note?.title ?? "");
    setDraftTags((note?.tags ?? []).join(", "));
    setDraftBody(note?.body ?? "");
    setDirty(false);
  }, [selectedId, notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => (n.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      const matchesQuery =
        !q ||
        (n.title ?? "").toLowerCase().includes(q) ||
        (n.body ?? "").toLowerCase().includes(q);
      const matchesTag = !activeTag || (n.tags ?? []).includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [notes, search, activeTag]);

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleNew = async () => {
    if (!userId) {
      setActionError("You are signed out. Sign in again to create notes.");
      return;
    }
    setActionError(null);
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: userId, title: "Untitled", body: "", tags: [] })
      .select()
      .single();
    if (error || !data) {
      setActionError(`Could not create the note: ${error?.message ?? "unknown error"}`);
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
    setSelectedId((data as Note).id);
  };

  const handleSave = useCallback(async () => {
    const noteId = selectedId;
    if (!noteId) return;
    setSaving(true);
    setActionError(null);
    const tags = parseTags(draftTags);
    const { data, error } = await supabase
      .from("notes")
      .update({
        title: draftTitle || "Untitled",
        body: draftBody,
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .select()
      .single();
    if (error || !data) {
      setActionError(
        `Could not save: ${error?.message ?? "the note no longer exists"}. Your text is still here — try again.`,
      );
      setSaving(false);
      return;
    }
    setNotes((prev) =>
      [...prev.map((n) => (n.id === noteId ? (data as Note) : n))].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    );
    setDirty(false);
    setSaving(false);
  }, [supabase, selectedId, draftTitle, draftTags, draftBody]);

  // Debounced autosave on edits
  useEffect(() => {
    if (!dirty || !selectedNote) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      handleSave();
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftTags, draftBody, dirty]);

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!confirm(`Delete "${selectedNote.title || "Untitled"}"? This cannot be undone.`)) return;
    setActionError(null);
    // A pending autosave would resurrect the note's contents after the delete.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const { error } = await supabase.from("notes").delete().eq("id", selectedNote.id);
    if (error) {
      setActionError(`Could not delete the note: ${error.message}`);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
    setSelectedId(null);
  };

  // Switching notes while an edit is pending would drop it, because the
  // debounced save is cancelled on unmount of the timer. Flush first.
  const handleSelect = async (id: string) => {
    if (id === selectedId) return;
    if (dirty) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await handleSave();
    }
    setSelectedId(id);
  };

  const previewHtml = useMemo(() => renderMarkdownLite(draftBody), [draftBody]);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left pane: list */}
      <div className="flex w-full flex-col border-b border-border md:h-screen md:w-80 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 pb-3">
          <h1 className="text-lg font-semibold">Notes</h1>
          <button className="btn btn-primary text-xs" onClick={handleNew}>
            + New note
          </button>
        </div>

        <div className="px-4 pb-3">
          <input
            className="input w-full"
            placeholder="Search title or body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            <button
              onClick={() => setActiveTag(null)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                activeTag === null
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              all
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  activeTag === tag
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {actionError && <p className="px-4 pb-3 text-sm text-danger">{actionError}</p>}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p className="px-2 py-4 text-sm text-danger">Could not load your notes: {loadError}</p>
          ) : filteredNotes.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              {notes.length === 0
                ? "No notes yet. Create your first note to get started."
                : "No notes match your search or filter."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filteredNotes.map((note) => (
                <li key={note.id}>
                  <button
                    onClick={() => handleSelect(note.id)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      note.id === selectedId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{note.title || "Untitled"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {(note.body || "").slice(0, 80) || "No content"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted">{formatDate(note.updated_at)}</span>
                      {(note.tags ?? []).slice(0, 3).map((t) => (
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
        {!selectedNote ? (
          <div className="card flex h-full min-h-[300px] items-center justify-center p-8 text-center">
            <p className="text-sm text-muted">
              Select a note on the left, or create a new one to start writing.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <input
                className="input w-full text-base font-medium"
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
                <button className="btn btn-secondary text-xs" onClick={handleSave} disabled={saving}>
                  Save
                </button>
                <button className="btn btn-secondary text-xs text-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>

            <input
              className="input w-full text-sm"
              placeholder="Tags, comma separated (e.g. work, ideas)"
              value={draftTags}
              onChange={(e) => {
                setDraftTags(e.target.value);
                setDirty(true);
              }}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Body (markdown-lite: # heading, **bold**, *italic*)</span>
                <textarea
                  className="input min-h-[400px] w-full resize-y font-mono text-sm leading-relaxed"
                  placeholder="Write your note…"
                  value={draftBody}
                  onChange={(e) => {
                    setDraftBody(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Preview</span>
                <div
                  className="card min-h-[400px] w-full overflow-y-auto p-3 text-sm leading-relaxed [&_h3]:text-base [&_h4]:text-sm [&_h5]:text-sm [&_p]:mb-1"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
