"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Diagram = {
  id: string;
  user_id: string;
  title: string;
  source: string;
  updated_at: string;
  created_at: string;
};

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

const DEFAULT_SOURCE = "graph TD\n  A --> B";
const DEFAULT_TITLE = "Untitled diagram";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function safeFilename(title: string): string {
  const trimmed = title.trim() || "diagram";
  return trimmed.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
}

export default function DiagramsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState(DEFAULT_TITLE);
  const [draftSource, setDraftSource] = useState(DEFAULT_SOURCE);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mermaidRef = useRef<MermaidApi | null>(null);
  const renderCounter = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDiagrams = useCallback(
    async (uid: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("diagrams")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setDiagrams((data ?? []) as Diagram[]);
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
        setLoadError("You are signed out. Sign in again to see your diagrams.");
        setLoading(false);
        return;
      }
      await loadDiagrams(user.id);
    })();
  }, [supabase, loadDiagrams]);

  // Load mermaid once on the client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("mermaid");
      if (cancelled) return;
      const mermaid = mod.default as unknown as MermaidApi;
      // htmlLabels: false renders labels as native <text>, not <foreignObject>.
      // foreignObject content is not painted when an SVG is drawn into a canvas,
      // which would silently blank out every label in the PNG export.
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        htmlLabels: false,
        flowchart: { htmlLabels: false },
      });
      mermaidRef.current = mermaid;
      setMermaidReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderDiagram = useCallback(async (source: string) => {
    const mermaid = mermaidRef.current;
    if (!mermaid) return;
    if (!source.trim()) {
      setSvgMarkup("");
      setRenderError(null);
      return;
    }
    try {
      renderCounter.current += 1;
      const id = `mermaid-diagram-${renderCounter.current}`;
      const { svg } = await mermaid.render(id, source);
      setSvgMarkup(svg);
      setRenderError(null);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Failed to render diagram");
    }
  }, []);

  // Debounced re-render whenever the source changes.
  useEffect(() => {
    if (!mermaidReady) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      renderDiagram(draftSource);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [draftSource, mermaidReady, renderDiagram]);

  const handleSelect = (d: Diagram) => {
    setSelectedId(d.id);
    setDraftTitle(d.title ?? DEFAULT_TITLE);
    setDraftSource(d.source ?? DEFAULT_SOURCE);
    setDirty(false);
  };

  const handleNew = () => {
    setSelectedId(null);
    setDraftTitle(DEFAULT_TITLE);
    setDraftSource(DEFAULT_SOURCE);
    setDirty(false);
  };

  const handleSave = async () => {
    if (!userId) {
      setActionError("You are signed out. Sign in again to save this diagram.");
      return;
    }
    setActionError(null);
    setSaving(true);
    const payload: Partial<Diagram> & { user_id: string } = {
      user_id: userId,
      title: draftTitle.trim() || DEFAULT_TITLE,
      source: draftSource,
      updated_at: new Date().toISOString(),
    };
    if (selectedId) payload.id = selectedId;

    const { data, error } = await supabase
      .from("diagrams")
      .upsert(payload)
      .select()
      .single();

    if (error || !data) {
      setActionError(error?.message ?? "Could not save that diagram. Try again.");
    } else {
      const saved = data as Diagram;
      setDiagrams((prev) => {
        const exists = prev.some((d) => d.id === saved.id);
        const next = exists ? prev.map((d) => (d.id === saved.id ? saved : d)) : [saved, ...prev];
        return [...next].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
      setSelectedId(saved.id);
      setDirty(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diagram? This cannot be undone.")) return;
    setActionError(null);
    const { error } = await supabase.from("diagrams").delete().eq("id", id);
    if (error) {
      setActionError(`Could not delete that diagram: ${error.message}`);
      return;
    }
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) handleNew();
  };

  const handleExportSvg = () => {
    const svgEl = previewRef.current?.querySelector("svg");
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    downloadBlob(blob, `${safeFilename(draftTitle)}.svg`);
  };

  const handleExportPng = () => {
    const svgEl = previewRef.current?.querySelector("svg");
    if (!svgEl) return;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const rect = svgEl.getBoundingClientRect();
      const scale = 2;
      const width = Math.max(1, Math.round((rect.width || img.width || 800) * scale));
      const height = Math.max(1, Math.round((rect.height || img.height || 600) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        setActionError("This browser can't use a 2D canvas, so PNG export is unavailable.");
        return;
      }

      try {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${safeFilename(draftTitle)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setActionError(null);
      } catch {
        setActionError("Could not export this diagram as a PNG. Export SVG instead.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setActionError("Could not export this diagram as a PNG. Export SVG instead.");
    };
    img.src = url;
  };

  return (
    <div className="flex min-h-screen flex-col p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Diagrams</h1>
          <p className="mt-1 text-sm text-muted">Write Mermaid syntax on the left, see it rendered live on the right.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={handleExportSvg} disabled={!svgMarkup}>
            Export SVG
          </button>
          <button className="btn btn-secondary" onClick={handleExportPng} disabled={!svgMarkup}>
            Export PNG
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !userId}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {actionError && <p className="mt-3 text-sm text-danger">{actionError}</p>}

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Sidebar */}
        <div className="card animate-fade-in flex max-h-56 w-full shrink-0 flex-col p-3 md:max-h-none md:w-56">
          <button className="btn btn-secondary w-full" onClick={handleNew}>
            + New
          </button>
          <div className="mt-3 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-1 py-2 text-xs text-muted">Loading…</p>
            ) : loadError ? (
              <p className="px-1 py-2 text-xs text-danger">Could not load your diagrams: {loadError}</p>
            ) : diagrams.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted">
                No diagrams yet. Write some Mermaid on the right and hit Save to keep it.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {diagrams.map((d) => (
                  <li key={d.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => handleSelect(d)}
                      className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        selectedId === d.id
                          ? "bg-surface-hover text-foreground"
                          : "text-muted hover:bg-surface-hover hover:text-foreground"
                      }`}
                      title={d.title}
                    >
                      <span className="block truncate">{d.title || DEFAULT_TITLE}</span>
                      <span className="block truncate text-[10px] text-muted">{formatDate(d.updated_at)}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="shrink-0 rounded-md px-1.5 py-1 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      title="Delete"
                      aria-label={`Delete ${d.title || DEFAULT_TITLE}`}
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3 fill-none stroke-current stroke-[1.5]"
                        aria-hidden="true"
                      >
                        <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <input
            className="input w-full"
            value={draftTitle}
            onChange={(e) => {
              setDraftTitle(e.target.value);
              setDirty(true);
            }}
            placeholder="Diagram title"
          />

          <div className="grid min-h-[420px] flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="card flex min-h-0 flex-col overflow-hidden">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted">Mermaid source</div>
              <textarea
                className="input flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed"
                value={draftSource}
                onChange={(e) => {
                  setDraftSource(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
                placeholder={DEFAULT_SOURCE}
              />
            </div>

            <div className="card flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium text-muted">Preview</span>
                {dirty && <span className="text-[10px] text-muted">unsaved changes</span>}
              </div>
              <div className="relative flex-1 overflow-auto p-4">
                {renderError && (
                  <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {renderError}
                  </div>
                )}
                <div
                  ref={previewRef}
                  className="flex min-h-full items-center justify-center [&_svg]:h-auto [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
