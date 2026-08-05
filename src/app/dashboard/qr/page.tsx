"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

type QrCode = {
  id: string;
  user_id: string;
  label: string | null;
  content: string;
  created_at: string;
};

type QrCodeWithImage = QrCode & { imageUrl: string | null };

const supabase = createClient();

function fileBase(label: string | null, fallback: string) {
  const base = (label || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "qr-code";
}

export default function QrCodesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [codes, setCodes] = useState<QrCodeWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("qr_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as QrCode[];
    // toDataURL rejects on empty or over-long content. One bad row must not
    // reject the whole Promise.all and leave the page stuck on "Loading…".
    const withImages = await Promise.all(
      rows.map(async (row) => {
        try {
          const imageUrl = await QRCode.toDataURL(row.content, {
            width: 400,
            margin: 1,
          });
          return { ...row, imageUrl };
        } catch {
          return { ...row, imageUrl: null };
        }
      }),
    );

    setCodes(withImages);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      await loadCodes();
    })();
  }, [loadCodes]);

  useEffect(() => {
    const value = content.trim();
    // No setState in the effect body — the render below ignores stale preview
    // state whenever the input is empty.
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, { width: 300, margin: 1 })
      .then((url) => {
        if (cancelled) return;
        setPreview(url);
        setPreviewError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(
          "That content is too long to fit in a QR code. Shorten it and try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [content]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Enter some content first.");
      return;
    }
    if (!userId) {
      setError("You need to be signed in to save a QR code.");
      return;
    }
    if (previewError) {
      setError(previewError);
      return;
    }

    setSaving(true);

    // `label` is `not null default ''` in the schema, so send "" not null.
    const { error: insertError } = await supabase.from("qr_codes").insert({
      user_id: userId,
      content: content.trim(),
      label: label.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setContent("");
    setLabel("");
    setPreview(null);
    setPreviewError(null);
    setSaving(false);
    await loadCodes();
  }

  async function handleDelete(id: string) {
    setError(null);
    setCodes((prev) => prev.filter((c) => c.id !== id));
    const { error: deleteError } = await supabase.from("qr_codes").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      await loadCodes();
    }
  }

  async function handleDownloadSvg(code: QrCode) {
    setError(null);
    try {
      const svg = await QRCode.toString(code.content, {
        type: "svg",
        margin: 1,
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase(code.label, "qr-code")}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not build an SVG for that content.");
    }
  }

  // The preview effect never clears state on an empty input (that would be a
  // synchronous setState in an effect), so drop stale values here instead.
  const hasContent = content.trim().length > 0;
  const activePreview = hasContent ? preview : null;
  const activePreviewError = hasContent ? previewError : null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">QR Codes</h1>
      <p className="mt-1 text-sm text-muted">
        Generate a QR code for any URL or text, save it, and download it as PNG
        or SVG anytime. Codes are static — editing the content later means
        generating a new code.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <form onSubmit={handleSubmit} className="card animate-fade-in flex flex-col gap-3 p-4">
          <div>
            <label htmlFor="content" className="mb-1 block text-xs text-muted">
              Content (URL or text)
            </label>
            <input
              id="content"
              className="input w-full"
              placeholder="https://example.com"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="label" className="mb-1 block text-xs text-muted">
              Label (optional)
            </label>
            <input
              id="label"
              className="input w-full"
              placeholder="My website"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {activePreviewError && !error && (
            <p className="text-sm text-danger">{activePreviewError}</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary self-start"
            disabled={saving || !hasContent || !!activePreviewError}
          >
            {saving ? "Saving…" : "Generate & Save"}
          </button>
        </form>

        <div className="card animate-fade-in flex w-full flex-col items-center justify-center gap-2 p-4 lg:w-48">
          {activePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activePreview} alt="QR code preview" className="h-40 w-40 rounded-md bg-white p-2" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-muted">
              Preview appears here
            </div>
          )}
          <p className="text-xs text-muted">Live preview</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Saved codes</h2>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No QR codes yet. Generate your first one above.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {codes.map((code, i) => (
            <div
              key={code.id}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="card animate-fade-in flex flex-col gap-2 p-4"
            >
              {code.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={code.imageUrl}
                  alt={code.label || code.content}
                  className="h-32 w-32 self-center rounded-md bg-white p-2"
                />
              ) : (
                <div className="flex h-32 w-32 self-center items-center justify-center rounded-md border border-dashed border-border p-2 text-center text-xs text-muted">
                  Content too long to render
                </div>
              )}
              <p className="truncate text-sm font-medium">{code.label || "Untitled"}</p>
              <p className="truncate text-xs text-muted" title={code.content}>
                {code.content}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {code.imageUrl && (
                  <>
                    <a
                      href={code.imageUrl}
                      download={`${fileBase(code.label, "qr-code")}.png`}
                      className="btn btn-secondary flex-1 text-center text-xs"
                    >
                      PNG
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDownloadSvg(code)}
                      className="btn btn-secondary flex-1 text-center text-xs"
                    >
                      SVG
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(code.id)} className="btn btn-secondary text-xs text-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
