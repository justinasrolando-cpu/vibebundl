"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Palette = {
  id: string;
  user_id: string;
  name: string;
  colors: string[] | null;
  created_at: string;
};

type Swatch = { hex: string; locked: boolean };

const SWATCH_COUNT = 5;

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

/** Pleasant-ish color: full hue range, mid-high saturation, mid lightness. */
function randomHex(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 45 + Math.floor(Math.random() * 40); // 45–84%
  const l = 38 + Math.floor(Math.random() * 30); // 38–67%
  return hslToHex(h, s, l);
}

/** Deterministic starting row so server and client markup match on hydration. */
const DEFAULT_HEXES = ["#5B7CFA", "#4FC3A1", "#F2B25C", "#E2685F", "#8A6BD1"];

function defaultSwatches(): Swatch[] {
  return DEFAULT_HEXES.map((hex) => ({ hex, locked: false }));
}

/** Pick readable text color for a hex background using relative luminance. */
function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.45 ? "#111111" : "#FFFFFF";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PalettesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [swatches, setSwatches] = useState<Swatch[]>(defaultSwatches);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setLoadError("You need to be signed in to see your saved palettes.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("color_palettes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setPalettes((data ?? []) as Palette[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const generate = useCallback(() => {
    setSwatches((prev) =>
      prev.map((s) => (s.locked ? s : { hex: randomHex(), locked: false })),
    );
  }, []);

  // Randomize once after hydration so each visit opens on a fresh row.
  useEffect(() => {
    setSwatches(
      Array.from({ length: SWATCH_COUNT }, () => ({ hex: randomHex(), locked: false })),
    );
  }, []);

  // Spacebar shortcut — ignored while typing in an input/textarea.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      if (tag === "button" || tag === "a") return;
      e.preventDefault();
      generate();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate]);

  const toggleLock = (index: number) => {
    setSwatches((prev) =>
      prev.map((s, i) => (i === index ? { ...s, locked: !s.locked } : s)),
    );
  };

  const flashCopied = (label: string) => {
    setCopied(label);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1200);
  };

  const copyText = async (text: string, label: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(label);
    } catch {
      setCopyError(`Could not copy to clipboard — copy ${text} manually.`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setSaveError("You need to be signed in to save a palette.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("color_palettes")
      .insert({
        user_id: userId,
        name: name.trim() || "Untitled palette",
        colors: swatches.map((s) => s.hex),
      })
      .select()
      .single();
    if (error) {
      setSaveError(error.message);
    } else if (data) {
      setPalettes((prev) => [data as Palette, ...prev]);
      setName("");
    }
    setSaving(false);
  };

  const handleLoad = (palette: Palette) => {
    const colors = palette.colors ?? [];
    setSwatches((prev) =>
      Array.from({ length: SWATCH_COUNT }, (_, i) => ({
        hex: (colors[i] ?? prev[i]?.hex ?? randomHex()).toUpperCase(),
        locked: false,
      })),
    );
    setRowError(null);
  };

  const handleDelete = async (palette: Palette) => {
    setRowError(null);
    setBusyId(palette.id);
    const { error } = await supabase
      .from("color_palettes")
      .delete()
      .eq("id", palette.id)
      .eq("user_id", palette.user_id);
    if (error) {
      setRowError(error.message);
    } else {
      setPalettes((prev) => prev.filter((p) => p.id !== palette.id));
    }
    setBusyId(null);
  };

  const currentHexList = swatches.map((s) => s.hex).join(", ");
  const lockedCount = swatches.filter((s) => s.locked).length;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Color Palettes</h1>
          <p className="mt-1 text-sm text-muted">
            Press <kbd className="rounded border border-border px-1 text-xs">space</kbd> or hit
            Generate to reroll unlocked swatches. Click a swatch to copy its hex.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            {lockedCount} of {SWATCH_COUNT} locked
          </span>
          <button type="button" className="btn btn-primary text-sm" onClick={generate}>
            Generate
          </button>
        </div>
      </div>

      {/* Working row */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {swatches.map((swatch, i) => (
          <div key={i} className="flex flex-col overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => copyText(swatch.hex, `swatch-${i}`)}
              title={`Copy ${swatch.hex}`}
              className="flex h-32 w-full items-end justify-center pb-3 transition-opacity hover:opacity-90 sm:h-44"
              style={{ backgroundColor: swatch.hex, color: textOn(swatch.hex) }}
            >
              <span className="font-mono text-xs tracking-wide">
                {copied === `swatch-${i}` ? "Copied!" : swatch.hex}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleLock(i)}
              aria-pressed={swatch.locked}
              className={`flex items-center justify-center gap-1.5 bg-surface px-2 py-1.5 text-xs transition-colors hover:bg-surface-hover ${
                swatch.locked ? "text-accent" : "text-muted"
              }`}
            >
              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3 fill-none stroke-current stroke-[1.2]"
                aria-hidden="true"
              >
                <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
                {swatch.locked ? (
                  <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0v1.5" strokeLinecap="round" />
                ) : (
                  <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0" strokeLinecap="round" />
                )}
              </svg>
              {swatch.locked ? "Locked" : "Unlocked"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary text-xs"
          onClick={() => copyText(currentHexList, "current-all")}
        >
          {copied === "current-all" ? "Copied!" : "Copy all hex"}
        </button>
        <span className="font-mono text-xs text-muted">{currentHexList}</span>
      </div>

      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}

      {/* Save */}
      <form onSubmit={handleSave} className="card mt-5 flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input w-full text-sm"
            placeholder="Palette name (e.g. Landing page hero)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary shrink-0 text-sm" disabled={saving}>
            {saving ? "Saving…" : "Save palette"}
          </button>
        </div>
        {saveError && <p className="text-sm text-danger">{saveError}</p>}
      </form>

      {/* Saved list */}
      <div className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Saved palettes
          {palettes.length > 0 && (
            <span className="ml-1.5 font-normal normal-case">({palettes.length})</span>
          )}
        </h2>

        {rowError && <p className="mt-2 text-sm text-danger">{rowError}</p>}
        {loadError && <p className="mt-2 text-sm text-danger">{loadError}</p>}

        <div className="mt-3 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : palettes.length === 0 ? (
            <p className="text-sm text-muted">
              No saved palettes yet. Generate a row you like, give it a name, and hit Save palette.
            </p>
          ) : (
            palettes.map((palette) => {
              const colors = palette.colors ?? [];
              return (
                <div
                  key={palette.id}
                  className="card animate-fade-in flex flex-wrap items-center gap-3 p-3"
                >
                  <div className="flex overflow-hidden rounded-md border border-border">
                    {colors.length === 0 ? (
                      <span className="px-2 py-1 text-xs text-muted">No colors</span>
                    ) : (
                      colors.map((c, i) => (
                        <button
                          key={`${palette.id}-${i}`}
                          type="button"
                          onClick={() => copyText(c, `${palette.id}-${i}`)}
                          title={`Copy ${c}`}
                          className="h-8 w-8 transition-opacity hover:opacity-80"
                          style={{ backgroundColor: c }}
                          aria-label={`Copy ${c}`}
                        />
                      ))
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {palette.name || "Untitled palette"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {copied?.startsWith(`${palette.id}-`) ? (
                        <span className="text-accent">Copied!</span>
                      ) : (
                        colors.join(", ") || "—"
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(palette.created_at)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => handleLoad(palette)}
                      disabled={colors.length === 0}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      disabled={colors.length === 0}
                      onClick={() => copyText(colors.join(", "), `copy-${palette.id}`)}
                    >
                      {copied === `copy-${palette.id}` ? "Copied!" : "Copy all"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs text-danger"
                      onClick={() => handleDelete(palette)}
                      disabled={busyId === palette.id}
                    >
                      {busyId === palette.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
