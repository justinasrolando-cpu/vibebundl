"use client";

import Link from "next/link";
import ToolIcon from "@/components/ToolIcon";
import Glyph from "@/components/Glyph";
import { categoryKey, type Tool } from "@/lib/tools";

/**
 * One tool on the dashboard grid.
 *
 * The pin can't live inside the card, because the card is a link and an
 * anchor may not contain a button. So both sit in a positioned wrapper and
 * the pin is layered on top — which also means the pin's hit area is
 * genuinely its own, not a corner of a link that swallows the click.
 *
 * `data-cat` publishes the category hue to the icon tile below it.
 */
export default function ToolCard({
  tool,
  pinned,
  busy,
  onTogglePin,
  onOpen,
  className = "",
  index = 0,
}: {
  tool: Tool;
  pinned: boolean;
  busy: boolean;
  onTogglePin: (slug: string) => void;
  onOpen: (slug: string) => void;
  className?: string;
  /** Phase offset for the idle breathe, so a grid never pulses in unison. */
  index?: number;
}) {
  return (
    <div
      className={`pin-host ${className}`}
      data-cat={categoryKey(tool.category)}
      style={{ "--breathe-delay": `${(index % 7) * 850}ms` } as React.CSSProperties}
    >
      <Link
        href={`/dashboard/${tool.slug}`}
        onClick={() => onOpen(tool.slug)}
        className="card card-interactive breathe flex items-start gap-3 p-3.5 pr-10"
      >
        <span className="icon-tile icon-tile-cat" aria-hidden>
          <ToolIcon slug={tool.slug} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium tracking-tight">
            {tool.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-2">
            replaces {tool.replaces}
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={() => onTogglePin(tool.slug)}
        disabled={busy}
        data-pinned={pinned}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
        title={pinned ? "Unpin" : "Pin to the top"}
        className="pin-toggle"
      >
        <Glyph name="pin" filled={pinned} size={15} />
      </button>
    </div>
  );
}
