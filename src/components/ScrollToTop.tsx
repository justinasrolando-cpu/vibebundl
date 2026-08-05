"use client";

import { useEffect } from "react";

/**
 * Land at the top on reload.
 *
 * Browsers restore your previous scroll offset on refresh, which is right for
 * an article and wrong for a landing page — you reload to see the change you
 * just made and get dropped two thirds down the page. Setting
 * `scrollRestoration = "manual"` hands that decision back to us.
 *
 * A hash link (#pricing, #tools) is a deliberate destination, so it's left
 * alone. Back/forward still restore position, because that IS what you want
 * when navigating history.
 */
export default function ScrollToTop() {
  useEffect(() => {
    if (!("scrollRestoration" in history)) return;

    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (nav?.type !== "back_forward" && !window.location.hash) {
      window.scrollTo(0, 0);
    }

    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
