"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

type Source = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  size: number;
};

type Result = {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  size: number;
};

const FORMATS: { value: OutputFormat; label: string; ext: string }[] = [
  { value: "image/jpeg", label: "JPEG (smallest, no transparency)", ext: "jpg" },
  { value: "image/webp", label: "WebP (small, keeps transparency)", ext: "webp" },
  { value: "image/png", label: "PNG (lossless, keeps transparency)", ext: "png" },
];

function extFor(format: OutputFormat): string {
  return FORMATS.find((f) => f.value === format)?.ext ?? "img";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || "image";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode this image."));
    img.src = url;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerDownload(blob: Blob, filename: string) {
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

export default function ImageCompressorPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [quality, setQuality] = useState(0.8);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [maxWidth, setMaxWidth] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Object URLs we own, tracked in refs so cleanup never depends on stale state.
  const sourceUrlsRef = useRef<Set<string>>(new Set());
  const resultUrlsRef = useRef<Set<string>>(new Set());
  const runIdRef = useRef(0);

  // Revoke every object URL we created when the page unmounts.
  useEffect(() => {
    const sourceUrls = sourceUrlsRef.current;
    const resultUrls = resultUrlsRef.current;
    return () => {
      sourceUrls.forEach((u) => URL.revokeObjectURL(u));
      resultUrls.forEach((u) => URL.revokeObjectURL(u));
      sourceUrls.clear();
      resultUrls.clear();
    };
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Those files aren't images. Pick a PNG, JPG, WebP, GIF, or SVG.");
      return;
    }
    setError(null);

    const added: Source[] = [];
    const failed: string[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        // SVGs with no intrinsic width/height decode to 0×0 and would silently
        // export a 1×1 pixel. Reject them instead of producing garbage.
        if (!img.naturalWidth || !img.naturalHeight) {
          throw new Error("no intrinsic size");
        }
        sourceUrlsRef.current.add(url);
        added.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
        });
      } catch {
        URL.revokeObjectURL(url);
        failed.push(file.name);
      }
    }

    if (failed.length > 0) {
      setError(
        `Could not read: ${failed.join(", ")}. The file may be corrupt, an unsupported format, or an SVG with no width and height.`,
      );
    }
    if (added.length > 0) setSources((prev) => [...prev, ...added]);
  }, []);

  // Re-encode everything whenever the sources or the settings change.
  useEffect(() => {
    if (sources.length === 0) {
      resultUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      resultUrlsRef.current.clear();
      setResults({});
      setItemErrors({});
      setProgress(null);
      setWorking(false);
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    (async () => {
      setWorking(true);
      setProgress({ done: 0, total: sources.length });

      const parsedMax = maxWidth.trim() === "" ? null : Number(maxWidth);
      const limit =
        parsedMax !== null && Number.isFinite(parsedMax) && parsedMax > 0
          ? Math.round(parsedMax)
          : null;

      const nextResults: Record<string, Result> = {};
      const nextErrors: Record<string, string> = {};

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        try {
          const img = await loadImage(source.url);
          const scale = limit && img.naturalWidth > limit ? limit / img.naturalWidth : 1;
          const width = Math.max(1, Math.round(img.naturalWidth * scale));
          const height = Math.max(1, Math.round(img.naturalHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("This browser can't use a 2D canvas.");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          // JPEG has no alpha channel — flatten onto white so transparency
          // doesn't come out black.
          if (format === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, format, quality),
          );
          if (!blob) throw new Error("Encoding returned nothing.");

          nextResults[source.id] = {
            url: URL.createObjectURL(blob),
            blob,
            width,
            height,
            size: blob.size,
          };
        } catch (err) {
          nextErrors[source.id] =
            err instanceof Error ? err.message : "Could not compress this image.";
        }
        if (runIdRef.current !== runId) break;
        setProgress({ done: i + 1, total: sources.length });
      }

      if (cancelled || runIdRef.current !== runId) {
        // A newer run superseded this one — throw away what we just made.
        Object.values(nextResults).forEach((r) => URL.revokeObjectURL(r.url));
        return;
      }

      resultUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      resultUrlsRef.current.clear();
      Object.values(nextResults).forEach((r) => resultUrlsRef.current.add(r.url));

      setResults(nextResults);
      setItemErrors(nextErrors);
      setWorking(false);
      setProgress(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [sources, quality, format, maxWidth]);

  function handleRemove(id: string) {
    const source = sources.find((s) => s.id === id);
    if (source) {
      URL.revokeObjectURL(source.url);
      sourceUrlsRef.current.delete(source.url);
    }
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleClearAll() {
    sourceUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    sourceUrlsRef.current.clear();
    setSources([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownload(source: Source) {
    const result = results[source.id];
    if (!result) return;
    triggerDownload(result.blob, `${baseName(source.file.name)}-min.${extFor(format)}`);
  }

  async function handleDownloadAll() {
    const ready = sources.filter((s) => results[s.id]);
    if (ready.length === 0) return;
    setDownloadingAll(true);
    setError(null);
    try {
      for (const source of ready) {
        handleDownload(source);
        // Browsers drop simultaneous downloads — space them out.
        await sleep(400);
      }
    } catch {
      setError("The browser blocked one of the downloads. Try downloading images one at a time.");
    } finally {
      setDownloadingAll(false);
    }
  }

  // Only compare like with like — an image that failed to encode has no "after"
  // size, so counting its original would fake a huge saving.
  const readySources = sources.filter((s) => results[s.id]);
  const readyCount = readySources.length;
  const totalOriginal = readySources.reduce((sum, s) => sum + s.size, 0);
  const totalNew = readySources.reduce((sum, s) => sum + (results[s.id]?.size ?? 0), 0);
  const totalSaved =
    readyCount > 0 && totalOriginal > 0
      ? ((totalOriginal - totalNew) / totalOriginal) * 100
      : null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Image Compressor</h1>
      <p className="mt-1 text-sm text-muted">
        Shrink, resize, and convert images entirely inside this tab. Nothing is uploaded — there is
        no server, no queue, and no copy of your files anywhere. Turn off your wifi and it still
        works.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`animate-fade-in mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition-colors ${
          dragging ? "border-accent bg-surface-hover" : "border-border bg-surface/40"
        }`}
      >
        <p className="text-sm font-medium">Drop images here</p>
        <p className="mt-1 text-xs text-muted">PNG, JPG, WebP or GIF — as many as you like.</p>
        <p className="mt-1 text-[11px] text-muted-2">
          Output is always a single flat frame: animated GIFs keep only their first frame, and SVGs
          are rasterised at whatever size they declare.
        </p>
        <label className="btn btn-secondary mt-4 inline-flex cursor-pointer text-sm">
          Choose images
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </label>
      </div>

      {/* Settings */}
      <div className="card animate-fade-in mt-4 grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
        <div>
          <label className="text-xs text-muted" htmlFor="quality">
            Quality — {Math.round(quality * 100)}%
          </label>
          <input
            id="quality"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <p className="mt-1 text-[11px] text-muted">
            {format === "image/png"
              ? "PNG is lossless — quality has little or no effect."
              : "Lower quality means a smaller file. 80% is usually indistinguishable."}
          </p>
        </div>

        <div>
          <label className="text-xs text-muted" htmlFor="format">
            Output format
          </label>
          <select
            id="format"
            className="input mt-1 text-sm"
            value={format}
            onChange={(e) => setFormat(e.target.value as OutputFormat)}
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted" htmlFor="max-width">
            Max width in pixels (optional)
          </label>
          <input
            id="max-width"
            type="number"
            min={1}
            step={1}
            className="input mt-1 text-sm"
            placeholder="e.g. 1600 — leave blank to keep size"
            value={maxWidth}
            onChange={(e) => setMaxWidth(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted">
            Scales down proportionally. Images already narrower are left alone.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {/* Summary + actions */}
      {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="text-xs text-muted">
            {working ? (
              <span>
                Compressing{progress ? ` ${progress.done} of ${progress.total}` : ""}…
              </span>
            ) : (
              <span>
                {readyCount} of {sources.length} image{sources.length === 1 ? "" : "s"} ·{" "}
                {formatBytes(totalOriginal)} → {formatBytes(totalNew)}
                {totalSaved !== null && (
                  <span className={totalSaved >= 0 ? " text-accent" : " text-danger"}>
                    {" "}
                    ({totalSaved >= 0 ? "−" : "+"}
                    {Math.abs(totalSaved).toFixed(1)}% overall)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={working || downloadingAll || readyCount === 0}
              className="btn btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingAll ? "Downloading…" : `Download all (${readyCount})`}
            </button>
            <button type="button" onClick={handleClearAll} className="btn btn-secondary text-xs">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {sources.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-sm text-muted">
            No images yet. Drop a few above and they&apos;ll be re-encoded right here in your
            browser — you&apos;ll see the old and new size side by side before you download
            anything.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {sources.map((source) => {
            const result = results[source.id];
            const itemError = itemErrors[source.id];
            const saved = result && source.size > 0
              ? ((source.size - result.size) / source.size) * 100
              : null;
            const smaller = saved !== null && saved >= 0;

            return (
              <li key={source.id} className="card animate-fade-in p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="truncate text-sm font-medium">{source.file.name}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(source)}
                      disabled={!result}
                      className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(source.id)}
                      className="text-xs text-muted transition-colors hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Before */}
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Before</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={source.url}
                      alt={`${source.file.name} original`}
                      className="mt-2 h-32 w-full rounded-md object-contain"
                    />
                    <p className="mt-2 text-xs text-muted">
                      {source.width} × {source.height} · {formatBytes(source.size)}
                    </p>
                  </div>

                  {/* After */}
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">After</p>
                    {result ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={result.url}
                          alt={`${source.file.name} compressed`}
                          className="mt-2 h-32 w-full rounded-md object-contain"
                        />
                        <p className="mt-2 text-xs text-muted">
                          {result.width} × {result.height} · {formatBytes(result.size)}
                          {(result.width !== source.width || result.height !== source.height) && (
                            <span className="ml-1 text-accent">resized</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <div className="mt-2 flex h-32 items-center justify-center rounded-md border border-dashed border-border">
                        <p className="text-xs text-muted">
                          {itemError ? "Failed" : "Compressing…"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {saved !== null && (
                  <p className={`mt-3 text-sm font-medium ${smaller ? "text-accent" : "text-danger"}`}>
                    {smaller
                      ? `${saved.toFixed(1)}% smaller — saved ${formatBytes(source.size - (result?.size ?? 0))}`
                      : `${Math.abs(saved).toFixed(1)}% larger — try a lower quality, a max width, or WebP`}
                  </p>
                )}

                {itemError && <p className="mt-2 text-sm text-danger">{itemError}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
