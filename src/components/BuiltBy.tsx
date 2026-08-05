"use client";

import { useState } from "react";
import { BUILDER_AVATAR, BUILDER_HANDLE, BUILDER_URL } from "@/lib/site";

/**
 * "built by @handle", with a face.
 *
 * One person built 50-odd tools in a weekend, which is the entire credibility
 * argument for the product — an anonymous footer throws that away. A face and
 * a handle you can go and check turn it from a claim into something falsifiable.
 *
 * The avatar is a plain <img> rather than next/image on purpose: next/image
 * wants known dimensions and a configured remote host, and this is one 28px
 * square. If the file isn't there yet the error handler swaps in a monogram —
 * so the credit is never a broken-image icon, and adding the photo later is
 * dropping a file into public/ with no code change.
 */
export default function BuiltBy({ className = "" }: { className?: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <a
      href={BUILDER_URL}
      target="_blank"
      rel="noopener noreferrer me"
      className={`group inline-flex items-center gap-2 text-xs text-muted-2 transition-colors duration-[var(--dur-fast)] hover:text-foreground ${className}`}
    >
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 text-[0.625rem] font-semibold tracking-tight text-muted">
        {photoFailed ? (
          <span aria-hidden>JR</span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={BUILDER_AVATAR}
            alt=""
            width={28}
            height={28}
            className="size-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
        )}
      </span>
      <span>
        built by{" "}
        <span className="text-muted underline-offset-2 group-hover:text-foreground group-hover:underline">
          @{BUILDER_HANDLE}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-3 shrink-0 fill-current opacity-60 transition-opacity group-hover:opacity-100"
      >
        {/* The X mark, drawn rather than loaded — one more request for a
            14px glyph is not worth it, and this way it follows currentColor
            into light mode without a second asset. */}
        <path d="M13.94 10.47 21.2 2h-1.72l-6.3 7.35L8.15 2H2.4l7.61 11.08L2.4 22h1.72l6.65-7.76L16.05 22h5.75l-7.9-11.53Zm-2.36 2.74-.77-1.1L4.74 3.3h2.64l4.95 7.09.77 1.1 6.43 9.2h-2.64l-5.25-7.51Z" />
      </svg>
    </a>
  );
}
