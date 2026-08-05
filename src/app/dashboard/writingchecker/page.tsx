"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Draft = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  updated_at: string;
  created_at: string;
};

type Category = "long" | "passive" | "adverb" | "filler";

type Issue = { start: number; end: number; category: Category };

const CATEGORY_META: Record<
  Category,
  { label: string; hint: string; tint: string; dot: string }
> = {
  long: {
    label: "Very long sentences",
    hint: "Over 25 words. Split them or your reader loses the thread.",
    tint: "rgba(56, 189, 248, 0.18)",
    dot: "#38bdf8",
  },
  passive: {
    label: "Passive voice",
    hint: "A form of “be” plus a past participle. Name who did the thing.",
    tint: "rgba(168, 85, 247, 0.22)",
    dot: "#a855f7",
  },
  adverb: {
    label: "-ly adverbs",
    hint: "Usually a weak verb wearing a hat. Pick a stronger verb.",
    tint: "rgba(250, 204, 21, 0.20)",
    dot: "#facc15",
  },
  filler: {
    label: "Filler & weasel words",
    hint: "Words that add length but no meaning. Cut them.",
    tint: "rgba(248, 113, 113, 0.22)",
    dot: "#f87171",
  },
};

const CATEGORY_ORDER: Category[] = ["long", "passive", "adverb", "filler"];

const LONG_SENTENCE_WORDS = 25;
const WORDS_PER_MINUTE = 200;

const BE_FORMS = new Set(["is", "are", "was", "were", "be", "been", "being", "am"]);

const IRREGULAR_PARTICIPLES = new Set([
  "done", "gone", "seen", "made", "taken", "given", "written", "known", "shown",
  "held", "kept", "sent", "built", "found", "told", "brought", "bought", "caught",
  "taught", "thought", "left", "lost", "meant", "paid", "put", "read", "run",
  "said", "sold", "spent", "won", "broken", "chosen", "driven", "eaten", "fallen",
  "forgotten", "hidden", "spoken", "stolen", "worn", "born", "begun", "drawn",
  "grown", "thrown", "understood", "set", "cut", "hit", "let", "shut", "split",
  "spread", "lent", "dealt", "felt", "heard", "led", "met", "sung",
]);

const FILLER_WORDS = new Set([
  "very", "really", "just", "quite", "actually", "basically", "simply",
  "literally", "totally", "absolutely", "definitely", "certainly", "essentially",
  "virtually", "extremely", "fairly", "rather", "somewhat", "somehow", "pretty",
  "slightly", "relatively", "apparently", "seemingly", "obviously", "clearly",
  "honestly", "truly", "surely", "arguably", "generally", "usually", "mostly",
  "perhaps", "maybe", "probably", "practically", "particularly", "significantly",
  "various", "several", "many", "most", "some", "often", "overall",
]);

// Words that end in -ly but are not adverbs.
const LY_NON_ADVERBS = new Set([
  "only", "family", "reply", "apply", "supply", "july", "italy", "rely", "ugly",
  "holy", "silly", "early", "ally", "belly", "jelly", "fly", "ply", "rally",
  "melancholy", "assembly", "anomaly", "monopoly", "multiply", "imply", "comply",
  "bully", "folly", "gully", "lily", "poly", "sly", "wobbly", "friendly",
  "likely", "lonely", "lovely", "daily", "weekly", "monthly", "yearly", "costly",
  "deadly", "elderly", "orderly", "timely", "unlikely", "ghastly",
]);

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Vowel-group syllable heuristic: count vowel runs, drop a silent trailing "e", floor of 1. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;
  if (w.length > 2 && w.endsWith("e") && !/[aeiouy]e$/.test(w) && count > 1) {
    count -= 1;
  }
  return Math.max(1, count);
}

type Token = { text: string; lower: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({
      text: m[0],
      lower: m[0].toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return tokens;
}

type SentenceSpan = { start: number; end: number; words: number };

function findSentences(text: string, tokens: Token[]): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const re = /[^.!?…\n]*[.!?…]+["'”’)\]]*|[^.!?…\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = m.index + leading;
    const end = m.index + raw.length - trailing;
    const words = tokens.filter((t) => t.start >= start && t.end <= end).length;
    if (words === 0) continue;
    spans.push({ start, end, words });
  }
  return spans;
}

function isParticiple(word: string): boolean {
  if (IRREGULAR_PARTICIPLES.has(word)) return true;
  return word.length > 3 && word.endsWith("ed");
}

function isLyAdverb(word: string): boolean {
  return (
    word.length > 4 &&
    word.endsWith("ly") &&
    !LY_NON_ADVERBS.has(word) &&
    !FILLER_WORDS.has(word)
  );
}

type Analysis = {
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  avgWordsPerSentence: number;
  syllables: number;
  grade: number;
  readingSeconds: number;
  issues: Issue[];
  counts: Record<Category, number>;
};

function analyze(text: string): Analysis {
  const tokens = tokenize(text);
  const sentences = findSentences(text, tokens);
  const issues: Issue[] = [];
  const counts: Record<Category, number> = { long: 0, passive: 0, adverb: 0, filler: 0 };

  // Very long sentences.
  sentences.forEach((s) => {
    if (s.words > LONG_SENTENCE_WORDS) {
      counts.long += 1;
      issues.push({ start: s.start, end: s.end, category: "long" });
    }
  });

  // Passive voice: a be-form followed within 2 words by a past participle.
  for (let i = 0; i < tokens.length; i += 1) {
    if (!BE_FORMS.has(tokens[i].lower)) continue;
    for (let j = i + 1; j <= i + 2 && j < tokens.length; j += 1) {
      if (isParticiple(tokens[j].lower)) {
        counts.passive += 1;
        issues.push({ start: tokens[i].start, end: tokens[j].end, category: "passive" });
        i = j;
        break;
      }
    }
  }

  // -ly adverbs and filler words.
  tokens.forEach((t) => {
    if (FILLER_WORDS.has(t.lower)) {
      counts.filler += 1;
      issues.push({ start: t.start, end: t.end, category: "filler" });
    } else if (isLyAdverb(t.lower)) {
      counts.adverb += 1;
      issues.push({ start: t.start, end: t.end, category: "adverb" });
    }
  });

  const wordCount = tokens.length;
  const sentenceCount = sentences.length;
  const syllables = tokens.reduce((sum, t) => sum + countSyllables(t.text), 0);
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Flesch-Kincaid grade level.
  const grade =
    wordCount > 0 && sentenceCount > 0
      ? 0.39 * (wordCount / sentenceCount) + 11.8 * (syllables / wordCount) - 15.59
      : 0;

  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;

  return {
    words: wordCount,
    sentences: sentenceCount,
    paragraphs,
    characters: text.length,
    avgWordsPerSentence,
    syllables,
    grade,
    readingSeconds: Math.round((wordCount / WORDS_PER_MINUTE) * 60),
    issues,
    counts,
  };
}

/**
 * Escape first, then wrap flagged runs in tinted spans. Word-level categories
 * (filler > adverb > passive) win over the sentence-level "long" highlight so a
 * long sentence keeps showing the specific problems inside it.
 */
const PRIORITY: Record<Category, number> = { long: 1, passive: 2, adverb: 3, filler: 4 };

function buildHighlightedHtml(text: string, issues: Issue[], enabled: Set<Category>): string {
  if (!text) return "";
  const marks: (Category | null)[] = new Array(text.length).fill(null);

  issues.forEach((issue) => {
    if (!enabled.has(issue.category)) return;
    for (let i = issue.start; i < issue.end && i < marks.length; i += 1) {
      const current = marks[i];
      if (current === null || PRIORITY[issue.category] > PRIORITY[current]) {
        marks[i] = issue.category;
      }
    }
  });

  let html = "";
  let runStart = 0;
  for (let i = 1; i <= text.length; i += 1) {
    const prev = marks[runStart];
    if (i === text.length || marks[i] !== prev) {
      const chunk = escapeHtml(text.slice(runStart, i));
      if (prev === null) {
        html += chunk;
      } else {
        const meta = CATEGORY_META[prev];
        html += `<span style="background-color:${meta.tint};border-radius:3px;box-shadow:0 0 0 1px ${meta.tint}">${chunk}</span>`;
      }
      runStart = i;
    }
  }
  return html;
}

function formatReadingTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function gradeLabel(grade: number, words: number): string {
  if (words < 10) return "Needs more text";
  if (grade <= 6) return "Very easy — grade school";
  if (grade <= 9) return "Plain English — good for the web";
  if (grade <= 12) return "High school level";
  if (grade <= 15) return "Hard — college level";
  return "Very hard — dense and academic";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SAMPLE_TEXT =
  "The report was written by the committee, and it was reviewed very carefully by several stakeholders who basically wanted to make absolutely sure that nothing important had been overlooked before the final version was quietly circulated to everyone on the distribution list.\n\nWe simply need shorter sentences.";

export default function WritingCheckerPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState<Set<Category>>(
    () => new Set<Category>(["long", "passive", "adverb", "filler"]),
  );

  const load = useCallback(
    async (uid: string) => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("writing_drafts")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setDrafts((data ?? []) as Draft[]);
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
        setLoadError("You must be signed in to save drafts.");
        return;
      }
      setUserId(user.id);
      await load(user.id);
    })();
  }, [supabase, load]);

  const analysis = useMemo(() => analyze(body), [body]);

  const highlightedHtml = useMemo(
    () => buildHighlightedHtml(body, analysis.issues, enabled),
    [body, analysis.issues, enabled],
  );

  const toggleCategory = (category: Category) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleNew = () => {
    setSelectedId(null);
    setTitle("Untitled");
    setBody("");
    setDirty(false);
    setActionError(null);
  };

  const handleOpen = (draft: Draft) => {
    setSelectedId(draft.id);
    setTitle(draft.title || "Untitled");
    setBody(draft.body || "");
    setDirty(false);
    setActionError(null);
  };

  const handleSave = async () => {
    if (!userId) {
      setActionError("You must be signed in to save drafts.");
      return;
    }
    setActionError(null);
    setSaving(true);
    const payload = {
      title: title.trim() || "Untitled",
      body: body ?? "",
      updated_at: new Date().toISOString(),
    };

    if (selectedId) {
      const { data, error } = await supabase
        .from("writing_drafts")
        .update(payload)
        .eq("id", selectedId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) {
        setActionError(error?.message ?? "Could not save this draft.");
      } else {
        const updated = data as Draft;
        setDrafts((prev) =>
          prev
            .map((d) => (d.id === updated.id ? updated : d))
            .sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            ),
        );
        setDirty(false);
      }
    } else {
      const { data, error } = await supabase
        .from("writing_drafts")
        .insert({ user_id: userId, ...payload })
        .select()
        .single();
      if (error || !data) {
        setActionError(error?.message ?? "Could not create this draft.");
      } else {
        const created = data as Draft;
        setDrafts((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setDirty(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (draft: Draft) => {
    if (!userId) return;
    if (!confirm(`Delete "${draft.title || "Untitled"}"? This cannot be undone.`)) return;
    setActionError(null);
    setDeletingId(draft.id);
    const { error } = await supabase
      .from("writing_drafts")
      .delete()
      .eq("id", draft.id)
      .eq("user_id", userId);
    if (error) {
      setActionError(error.message);
    } else {
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      if (selectedId === draft.id) {
        setSelectedId(null);
        setDirty(true);
      }
    }
    setDeletingId(null);
  };

  const totalIssues = CATEGORY_ORDER.reduce((sum, c) => sum + analysis.counts[c], 0);

  return (
    <div className="flex h-screen flex-col lg:flex-row">
      {/* Drafts sidebar */}
      <div className="flex w-full flex-col border-b border-border lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-4 pb-3">
          <div>
            <h1 className="text-lg font-semibold">Writing Checker</h1>
            <p className="mt-0.5 text-xs text-muted">{drafts.length} saved draft{drafts.length === 1 ? "" : "s"}</p>
          </div>
          <button className="btn btn-primary shrink-0 text-xs" onClick={handleNew}>
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p className="px-2 py-4 text-sm text-danger">{loadError}</p>
          ) : drafts.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No drafts yet. Paste or write something on the right, give it a title, and hit
              Save to keep it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {drafts.map((d) => (
                <li key={d.id} className="group relative">
                  <button
                    onClick={() => handleOpen(d)}
                    className={`animate-fade-in w-full rounded-lg px-3 py-2 pr-14 text-left transition-colors ${
                      d.id === selectedId ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{d.title || "Untitled"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {(d.body || "").trim().slice(0, 60) || "Empty draft"}
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatDate(d.updated_at)}</p>
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    disabled={deletingId === d.id}
                    className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs text-muted transition-colors hover:text-danger"
                    aria-label={`Delete ${d.title || "Untitled"}`}
                  >
                    {deletingId === d.id ? "…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor + preview */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              className="input min-w-0 flex-1 text-base font-medium"
              placeholder="Draft title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted">
                {saving ? "Saving…" : dirty ? "Unsaved" : selectedId ? "Saved" : "Not saved yet"}
              </span>
              <button className="btn btn-primary text-xs" onClick={handleSave} disabled={saving}>
                {selectedId ? "Save" : "Save draft"}
              </button>
              {body.length === 0 && (
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => {
                    setBody(SAMPLE_TEXT);
                    setDirty(true);
                  }}
                >
                  Try sample
                </button>
              )}
            </div>
          </div>

          {actionError && <p className="text-sm text-danger">{actionError}</p>}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Left: the writing surface */}
            <div className="flex flex-col gap-4">
              <textarea
                className="input min-h-[340px] w-full resize-y text-sm leading-relaxed"
                placeholder="Write or paste your text here. Everything is analysed in your browser as you type — nothing is sent anywhere."
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setDirty(true);
                }}
              />

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    Highlighted preview (read-only) · {totalIssues} flag
                    {totalIssues === 1 ? "" : "s"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_ORDER.filter((c) => enabled.has(c)).map((c) => (
                      <span key={c} className="flex items-center gap-1 text-[11px] text-muted">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_META[c].dot }}
                        />
                        {CATEGORY_META[c].label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="card min-h-[160px] w-full overflow-y-auto p-3 text-sm leading-relaxed">
                  {body.trim().length === 0 ? (
                    <p className="text-sm text-muted">
                      Nothing to check yet. Start typing above and flagged sentences, passive
                      voice, adverbs, and filler words will light up here.
                    </p>
                  ) : enabled.size === 0 ? (
                    <p className="text-sm text-muted">
                      All categories are switched off. Turn one back on in the panel to see
                      highlights.
                    </p>
                  ) : (
                    <div
                      className="whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right: live analysis */}
            <div className="flex flex-col gap-4">
              <div className="card p-4">
                <h2 className="text-sm font-semibold">Readability</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Words" value={analysis.words.toLocaleString()} />
                  <Stat label="Sentences" value={analysis.sentences.toLocaleString()} />
                  <Stat
                    label="Avg words / sentence"
                    value={
                      analysis.sentences > 0 ? analysis.avgWordsPerSentence.toFixed(1) : "—"
                    }
                  />
                  <Stat label="Reading time" value={formatReadingTime(analysis.readingSeconds)} />
                  <Stat label="Paragraphs" value={analysis.paragraphs.toLocaleString()} />
                  <Stat label="Characters" value={analysis.characters.toLocaleString()} />
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted">Flesch-Kincaid grade</span>
                    <span className="text-lg font-semibold text-accent">
                      {analysis.words >= 10 ? analysis.grade.toFixed(1) : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {gradeLabel(analysis.grade, analysis.words)}
                  </p>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Issues</h2>
                  <span className="text-xs text-muted">click to toggle</span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {CATEGORY_ORDER.map((c) => {
                    const meta = CATEGORY_META[c];
                    const on = enabled.has(c);
                    return (
                      <li key={c}>
                        <button
                          onClick={() => toggleCategory(c)}
                          aria-pressed={on}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            on
                              ? "border-border bg-surface-hover"
                              : "border-border/60 opacity-55 hover:opacity-80"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: on ? meta.dot : "transparent", boxShadow: `inset 0 0 0 1px ${meta.dot}` }}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {meta.label}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                                analysis.counts[c] > 0 ? "text-foreground" : "text-muted"
                              }`}
                              style={{
                                backgroundColor:
                                  analysis.counts[c] > 0 ? meta.tint : "transparent",
                              }}
                            >
                              {analysis.counts[c]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted">{meta.hint}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {totalIssues === 0 && body.trim().length > 0 && (
                  <p className="mt-3 text-xs text-muted">
                    Nothing flagged. Clean, direct prose — ship it.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted">
                All checks run locally with plain heuristics, so treat them as hints rather than
                rules. Sentence length uses a {LONG_SENTENCE_WORDS}-word threshold and reading
                time assumes {WORDS_PER_MINUTE} words per minute.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
