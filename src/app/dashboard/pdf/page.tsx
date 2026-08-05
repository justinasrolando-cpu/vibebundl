"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

type MergeFile = {
  id: string;
  file: File;
};

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can abort a large download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Accepts "3", "2-4", or a comma-separated mix like "1, 4-6, 9".
 * Returns zero-based page indices in the order given, or null if anything in
 * the input is not a valid page for this document.
 */
function parsePageRange(input: string, pageCount: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const indices: number[] = [];
  for (const chunk of trimmed.split(",")) {
    const segment = chunk.trim();
    if (!segment) return null;

    const parts = segment.split("-").map((p) => p.trim());
    if (parts.length === 1) {
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 1 || n > pageCount) return null;
      indices.push(n - 1);
      continue;
    }
    if (parts.length === 2) {
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      if (
        parts[0] === "" ||
        parts[1] === "" ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        end > pageCount
      ) {
        return null;
      }
      for (let i = start; i <= end; i++) indices.push(i - 1);
      continue;
    }
    return null;
  }

  return indices.length > 0 ? indices : null;
}

function isEncryptedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /encrypt/i.test(message);
}

export default function PdfToolsPage() {
  // Merge state
  const [mergeFiles, setMergeFiles] = useState<MergeFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);

  // Split state
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const splitInputRef = useRef<HTMLInputElement | null>(null);

  function handleMergeFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const next: MergeFile[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
    }));
    setMergeFiles((prev) => [...prev, ...next]);
    setMergeError(null);
    if (mergeInputRef.current) mergeInputRef.current.value = "";
  }

  function removeMergeFile(id: string) {
    setMergeFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function moveMergeFile(index: number, delta: number) {
    setMergeFiles((prev) => {
      const target = index + delta;
      if (index < 0 || index >= prev.length || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  async function handleMerge() {
    if (mergeFiles.length < 2) {
      setMergeError("Add at least two PDF files to merge.");
      return;
    }
    setMerging(true);
    setMergeError(null);
    try {
      const merged = await PDFDocument.create();
      for (const { file } of mergeFiles) {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const copiedPages = await merged.copyPages(src, src.getPageIndices());
        copiedPages.forEach((page) => merged.addPage(page));
      }
      const outBytes = await merged.save();
      downloadBlob(outBytes, "merged.pdf");
    } catch (err) {
      setMergeError(
        isEncryptedError(err)
          ? "One of these PDFs is password-protected. Remove the password first, then merge."
          : "Could not merge these PDFs. Make sure every file is a valid PDF.",
      );
    } finally {
      setMerging(false);
    }
  }

  async function handleSplitFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSplitFile(file);
    setPageCount(null);
    setRangeInput("");
    setSplitError(null);
    setLoadingCount(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      setPageCount(doc.getPageCount());
    } catch (err) {
      setSplitError(
        isEncryptedError(err)
          ? "This PDF is password-protected. Remove the password first, then split it."
          : "Could not read this PDF. It may be corrupt or not a real PDF.",
      );
      setSplitFile(null);
    } finally {
      setLoadingCount(false);
      // Clear the input so re-picking the same file still fires onChange.
      if (splitInputRef.current) splitInputRef.current.value = "";
    }
  }

  function clearSplit() {
    setSplitFile(null);
    setPageCount(null);
    setRangeInput("");
    setSplitError(null);
    if (splitInputRef.current) splitInputRef.current.value = "";
  }

  async function handleExtractRange() {
    if (!splitFile || !pageCount) return;
    const indices = parsePageRange(rangeInput, pageCount);
    if (!indices) {
      setSplitError(
        `Enter pages like "2", "2-4", or "1, 4-6" — every page must be between 1 and ${pageCount}.`,
      );
      return;
    }
    setSplitting(true);
    setSplitError(null);
    try {
      const bytes = await splitFile.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const copiedPages = await out.copyPages(src, indices);
      copiedPages.forEach((page) => out.addPage(page));
      const outBytes = await out.save();
      const rangeLabel = rangeInput.trim().replace(/\s+/g, "").replace(/,/g, "_");
      downloadBlob(outBytes, `${splitFile.name.replace(/\.pdf$/i, "")}-p${rangeLabel}.pdf`);
    } catch {
      setSplitError("Could not extract those pages.");
    } finally {
      setSplitting(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">PDF Tools</h1>
      <p className="mt-1 text-sm text-muted">Merge or split PDFs, entirely in your browser. Files never leave your device.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Merge */}
        <div className="card animate-fade-in p-4">
          <h2 className="text-sm font-semibold">Merge PDFs</h2>
          <p className="mt-1 text-xs text-muted">
            Combine multiple PDFs into one, in the order listed below. Use the arrows to reorder.
          </p>

          <label className="btn btn-secondary mt-3 inline-flex cursor-pointer text-sm">
            Add PDF files
            <input
              ref={mergeInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleMergeFilesSelected}
              className="hidden"
            />
          </label>

          {mergeFiles.length === 0 ? (
            <p className="mt-4 text-xs text-muted">No files selected yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {mergeFiles.map((f, i) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
                >
                  <span className="truncate">
                    <span className="mr-2 text-muted">{i + 1}.</span>
                    {f.file.name}
                  </span>
                  <span className="ml-2 flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveMergeFile(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${f.file.name} up`}
                      className="rounded-md px-1 py-0.5 text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-[1.5]" aria-hidden="true">
                        <path d="M2.5 7.5L6 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMergeFile(i, 1)}
                      disabled={i === mergeFiles.length - 1}
                      aria-label={`Move ${f.file.name} down`}
                      className="rounded-md px-1 py-0.5 text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-[1.5]" aria-hidden="true">
                        <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMergeFile(f.id)}
                      className="text-muted transition-colors hover:text-danger"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {mergeError && <p className="mt-3 text-xs text-danger">{mergeError}</p>}

          <button
            type="button"
            onClick={handleMerge}
            disabled={merging || mergeFiles.length < 2}
            className="btn btn-primary mt-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {merging ? "Merging..." : "Merge & download"}
          </button>
        </div>

        {/* Split */}
        <div className="card animate-fade-in p-4">
          <h2 className="text-sm font-semibold">Split PDF</h2>
          <p className="mt-1 text-xs text-muted">
            Extract pages into a new PDF. Password-protected PDFs are not supported.
          </p>

          <label className="btn btn-secondary mt-3 inline-flex cursor-pointer text-sm">
            Choose PDF file
            <input
              ref={splitInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleSplitFileSelected}
              className="hidden"
            />
          </label>

          {loadingCount && <p className="mt-4 text-xs text-muted">Reading file...</p>}

          {splitFile && !loadingCount && pageCount !== null && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="truncate">
                  {splitFile.name} &middot; {pageCount} page{pageCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={clearSplit}
                  className="ml-2 shrink-0 text-muted transition-colors hover:text-danger"
                >
                  Remove
                </button>
              </div>

              <div>
                <label className="text-xs text-muted" htmlFor="page-range">
                  Pages to keep (1-{pageCount})
                </label>
                <input
                  id="page-range"
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 2-4 or 1, 4-6"
                  className="input mt-1 text-sm"
                />
              </div>

              {splitError && <p className="text-xs text-danger">{splitError}</p>}

              <button
                type="button"
                onClick={handleExtractRange}
                disabled={splitting || !rangeInput.trim()}
                className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {splitting ? "Extracting..." : "Extract & download"}
              </button>
            </div>
          )}

          {!splitFile && splitError && <p className="mt-3 text-xs text-danger">{splitError}</p>}
        </div>
      </div>
    </div>
  );
}
