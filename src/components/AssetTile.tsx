"use client";

import { useState } from "react";
import { svgDataUri } from "@/lib/brand";

/**
 * One downloadable asset: a preview, an SVG link, and PNG buttons.
 *
 * The PNGs are rasterised in the browser rather than committed as files.
 * Twelve variants at three sizes would be 36 binaries in the repo, all of
 * which go stale the moment the mark changes — and the only thing standing
 * between the SVG and a PNG is a canvas. So: load the SVG into an Image,
 * draw it at the requested size, `toBlob`, download. No build step, no
 * dependency, and the output can't drift from the vector because it *is*
 * the vector.
 *
 * The object URL is revoked after the click. Skipping that leaks the whole
 * bitmap for the lifetime of the document, which on a page offering 1024px
 * downloads adds up fast.
 */
export default function AssetTile({
  title,
  note,
  svg,
  filename,
  previewBg,
  sizes = [512, 1024],
  square = true,
}: {
  title: string;
  note: string;
  svg: string;
  filename: string;
  /**
   * Checkerboard for transparent assets, a flat colour otherwise. The
   * checkerboard comes in two tones because a paper knockout previewed on a
   * light checkerboard is invisible — the asset is correct, the preview is
   * useless, and the two are indistinguishable to whoever is looking.
   */
  previewBg: "dark" | "light" | "transparent" | "transparent-dark";
  sizes?: number[];
  square?: boolean;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const uri = svgDataUri(svg);

  async function downloadPng(size: number) {
    setBusy(size);
    try {
      const img = new Image();
      img.decoding = "sync";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = uri;
      });

      const w = size;
      const h = square ? size : Math.round(size * 0.25);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${w}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  const previewClass = {
    dark: "bg-[#08090a]",
    light: "bg-[#fafafa]",
    transparent: "checkerboard",
    "transparent-dark": "checkerboard checkerboard-dark",
  }[previewBg];

  return (
    <div className="card breathe flex flex-col overflow-hidden">
      <div className={`flex h-36 items-center justify-center px-6 ${previewClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uri}
          alt={`${title} preview`}
          className={square ? "h-20 w-20" : "h-14 w-auto max-w-full"}
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div>
          <h3 className="text-sm tracking-tight">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-2">{note}</p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <a className="btn btn-secondary text-xs" href={uri} download={`${filename}.svg`}>
            svg
          </a>
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => downloadPng(size)}
              disabled={busy !== null}
            >
              {busy === size ? "…" : `png ${size}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
