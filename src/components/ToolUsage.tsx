"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";
import { TOOLS_BY_SLUG } from "@/lib/tools";

/**
 * Which of the 53 people actually open.
 *
 * We shipped 53 tools on a guess and have been reasoning about which ones
 * matter from vibes ever since. The first outside feedback we got was
 * someone picking one tool, finding it thin, and generalising to the whole
 * bundle — and we had no data to say whether that tool was the one anybody
 * used. That is the gap this closes.
 *
 * It sends the tool slug and nothing else. No user id, no session, no
 * content: enough to rank 53 slugs by how often they're opened, and not
 * enough to reconstruct a person's behaviour. That restraint isn't
 * squeamishness — it's the same promise the privacy policy makes and that
 * Site Analytics is sold on, and breaking it here to learn slightly more
 * would make both a lie.
 *
 * Fires on pathname change rather than on mount because the dashboard is a
 * client-side SPA: navigating between tools never remounts the layout, so a
 * mount-only effect would record the first tool of a session and nothing
 * after it.
 */
export default function ToolUsage() {
  const pathname = usePathname();

  useEffect(() => {
    const slug = pathname?.split("/")[2];
    // Ignore /dashboard itself and any path that isn't a real tool, so a
    // typo or a future non-tool page can't invent a row in the ranking.
    if (!slug || !TOOLS_BY_SLUG.has(slug)) return;

    track("tool_opened", { tool: slug });
  }, [pathname]);

  return null;
}
