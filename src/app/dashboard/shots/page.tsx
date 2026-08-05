"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Shot = {
  img: HTMLImageElement;
  name: string;
  width: number;
  height: number;
};

type Preset = {
  id: string;
  label: string;
  from: string;
  to: string;
};

const PRESETS: Preset[] = [
  { id: "sunset", label: "Sunset", from: "#ff7e5f", to: "#feb47b" },
  { id: "ocean", label: "Ocean", from: "#2193b0", to: "#6dd5ed" },
  { id: "grape", label: "Grape", from: "#654ea3", to: "#eaafc8" },
  { id: "mint", label: "Mint", from: "#00b09b", to: "#96c93d" },
  { id: "midnight", label: "Midnight", from: "#232526", to: "#414345" },
  { id: "candy", label: "Candy", from: "#c471f5", to: "#fa71cd" },
];

const ASPECTS: { value: string; label: string; ratio: number | null }[] = [
  { value: "auto", label: "Auto (fits the screenshot)", ratio: null },
  { value: "16:9", label: "16 : 9 — slides, X/Twitter", ratio: 16 / 9 },
  { value: "4:3", label: "4 : 3 — classic", ratio: 4 / 3 },
  { value: "1:1", label: "1 : 1 — square", ratio: 1 },
];

// Cap the exported bitmap so a 5K screenshot with heavy padding can't blow up memory.
const MAX_DIM = 4000;

function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || "screenshot";
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image."));
    img.src = url;
  });
}

/** Rounded-rect path with a manual arcTo fallback for browsers without roundRect. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  const maybeRoundRect = (ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  }).roundRect;
  if (typeof maybeRoundRect === "function") {
    maybeRoundRect.call(ctx, x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export default function ShotsPage() {
  const [shot, setShot] = useState<Shot | null>(null);
  const [presetId, setPresetId] = useState<string>("grape");
  const [solidColor, setSolidColor] = useState("#111827");
  const [paddingPct, setPaddingPct] = useState(8);
  const [radiusPct, setRadiusPct] = useState(3);
  const [shadowOn, setShadowOn] = useState(true);
  const [shadowIntensity, setShadowIntensity] = useState(55);
  const [aspect, setAspect] = useState("auto");

  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outSize, setOutSize] = useState<{ w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // The object URL backing the current image — tracked in a ref so cleanup never
  // depends on stale state.
  const objectUrlRef = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => releaseUrl(), [releaseUrl]);

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("That file isn't an image. Drop a PNG, JPG, or WebP screenshot.");
        return;
      }
      setError(null);
      setCopied(false);
      setLoadingFile(true);
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImageFromUrl(url);
        releaseUrl();
        objectUrlRef.current = url;
        setShot({
          img,
          name: file.name || "pasted-screenshot.png",
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch {
        URL.revokeObjectURL(url);
        setError("Could not read that image. It may be corrupt or an unsupported format.");
      } finally {
        setLoadingFile(false);
      }
    },
    [releaseUrl],
  );

  // Paste from clipboard — how people actually get a screenshot into a tool like this.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            loadFile(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  // Live re-render whenever the image or any control changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shot) {
      setOutSize(null);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("This browser can't use a 2D canvas, so the preview can't be drawn.");
      return;
    }

    const iw = shot.width;
    const ih = shot.height;
    const pad = (paddingPct / 100) * Math.max(iw, ih);

    let contentW = iw + pad * 2;
    let contentH = ih + pad * 2;
    const ratio = ASPECTS.find((a) => a.value === aspect)?.ratio ?? null;
    if (ratio) {
      // Letterbox: grow the shorter axis until the frame matches the target ratio.
      if (contentW / contentH < ratio) contentW = contentH * ratio;
      else contentH = contentW / ratio;
    }

    const scale = Math.min(1, MAX_DIM / Math.max(contentW, contentH));
    const W = Math.max(1, Math.round(contentW * scale));
    const H = Math.max(1, Math.round(contentH * scale));
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    const radius = (radiusPct / 100) * Math.min(dw, dh);

    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    // Background
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, preset.from);
      grad.addColorStop(1, preset.to);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = solidColor;
    }
    ctx.fillRect(0, 0, W, H);

    // Shadow: cast it off an opaque rounded rect, then draw the image on top.
    if (shadowOn && shadowIntensity > 0) {
      const s = shadowIntensity / 100;
      const unit = Math.min(dw, dh) / 700;
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${(0.15 + s * 0.5).toFixed(3)})`;
      ctx.shadowBlur = s * 70 * Math.max(unit, 0.4);
      ctx.shadowOffsetY = s * 28 * Math.max(unit, 0.4);
      ctx.fillStyle = "#000000";
      roundedRectPath(ctx, dx, dy, dw, dh, radius);
      ctx.fill();
      ctx.restore();
    }

    // Rounded screenshot via path clipping
    ctx.save();
    roundedRectPath(ctx, dx, dy, dw, dh, radius);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(shot.img, dx, dy, dw, dh);
    ctx.restore();

    setOutSize({ w: W, h: H });
    setCopied(false);
  }, [shot, presetId, solidColor, paddingPct, radiusPct, shadowOn, shadowIntensity, aspect]);

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !shot) return;
    setError(null);
    try {
      // toBlob rather than toDataURL — a 4000px export is tens of megabytes as a
      // base64 string and browsers choke on data URLs that big.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Encoding returned nothing.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(shot.name)}-shot.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("The browser blocked the export. Try a smaller screenshot or less padding.");
    }
  }

  async function handleCopy() {
    const canvas = canvasRef.current;
    if (!canvas || !shot) return;
    setError(null);
    setCopying(true);
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error(
          "This browser won't let a page write images to the clipboard. Use Download instead.",
        );
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Could not encode the image.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
    } catch (err) {
      setCopied(false);
      setError(
        err instanceof Error
          ? err.message
          : "Copying to the clipboard failed. Use Download instead.",
      );
    } finally {
      setCopying(false);
    }
  }

  function handleClear() {
    releaseUrl();
    setShot(null);
    setOutSize(null);
    setCopied(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const padPx = shot ? Math.round((paddingPct / 100) * Math.max(shot.width, shot.height)) : 0;
  const radiusPx = shot ? Math.round((radiusPct / 100) * Math.min(shot.width, shot.height)) : 0;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Screenshot Beautifier</h1>
      <p className="mt-1 text-sm text-muted">
        Drop a screenshot on a gradient, round the corners, add a shadow, export a PNG. Everything
        happens in this tab — nothing is uploaded anywhere.
      </p>
      <p className="mt-1 text-xs text-muted">
        One image at a time. No browser chrome, device mockups, 3D tilt, or annotations — just
        background, padding, corners, and shadow. Exports are capped at {MAX_DIM}px on the long
        edge.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Canvas / drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) loadFile(file);
          }}
          className={`animate-fade-in flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-4 transition-colors ${
            dragging ? "border-accent bg-surface-hover" : "border-border bg-surface/40"
          }`}
        >
          {shot ? (
            <>
              <canvas
                ref={canvasRef}
                className="max-h-[60vh] max-w-full rounded-md shadow-lg"
                aria-label="Beautified screenshot preview"
              />
              <p className="mt-3 text-xs text-muted">
                {shot.name} · source {shot.width} × {shot.height}
                {outSize && (
                  <>
                    {" "}
                    · export {outSize.w} × {outSize.h}
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">
                {loadingFile ? "Reading image…" : "Drop a screenshot here"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Or press ⌘V / Ctrl+V to paste one straight from your clipboard — take a screenshot,
                paste, done.
              </p>
              <label className="btn btn-secondary mt-4 inline-flex cursor-pointer text-sm">
                Choose an image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadFile(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="card animate-fade-in flex flex-col gap-5 p-4">
          <div>
            <p className="text-xs text-muted">Background</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => setPresetId(p.id)}
                  className={`h-10 rounded-md border transition-colors ${
                    presetId === p.id ? "border-accent" : "border-border hover:border-muted"
                  }`}
                  style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                >
                  <span className="sr-only">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPresetId("solid")}
                className={`btn btn-secondary flex-1 text-xs ${
                  presetId === "solid" ? "border-accent text-accent" : ""
                }`}
              >
                Solid colour
              </button>
              <input
                type="color"
                aria-label="Solid background colour"
                value={solidColor}
                onChange={(e) => {
                  setSolidColor(e.target.value);
                  setPresetId("solid");
                }}
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="padding">
              Padding — {paddingPct}%{shot ? ` (${padPx}px)` : ""}
            </label>
            <input
              id="padding"
              type="range"
              min={0}
              max={30}
              step={1}
              value={paddingPct}
              onChange={(e) => setPaddingPct(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="radius">
              Corner radius — {radiusPct}%{shot ? ` (${radiusPx}px)` : ""}
            </label>
            <input
              id="radius"
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={radiusPct}
              onChange={(e) => setRadiusPct(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={shadowOn}
                onChange={(e) => setShadowOn(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Drop shadow
            </label>
            <input
              id="shadow"
              type="range"
              min={0}
              max={100}
              step={1}
              disabled={!shadowOn}
              value={shadowIntensity}
              onChange={(e) => setShadowIntensity(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)] disabled:opacity-40"
            />
            <p className="mt-1 text-[11px] text-muted">
              {shadowOn ? `Intensity ${shadowIntensity}%` : "Shadow off"}
            </p>
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="aspect">
              Aspect ratio
            </label>
            <select
              id="aspect"
              className="input mt-1 text-sm"
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
            >
              {ASPECTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Anything other than auto letterboxes the shot inside the background.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!shot}
              className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!shot || copying}
              className="btn btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copying ? "Copying…" : copied ? "Copied to clipboard" : "Copy to clipboard"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!shot}
              className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
