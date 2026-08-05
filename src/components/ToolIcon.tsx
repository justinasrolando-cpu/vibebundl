import type { ReactNode } from "react";

/**
 * The icon system.
 *
 * 53 hand-drawn 24×24 stroke icons, one per tool, keyed by slug. No icon
 * dependency: every path lives here so the whole set stays optically
 * consistent — same 1.5 stroke, same round joins, same ~3px optical margin.
 *
 * Rules the set follows, so nothing looks borrowed:
 *   · geometry over illustration — circles, rects, and straight runs
 *   · one idea per icon; never two metaphors stacked
 *   · conceptual neighbours (notes/wiki/blog, mic/speaker/bot) are drawn
 *     from different primitives so they never read as the same glyph
 */

const PATHS: Record<string, ReactNode> = {
  /* ---------- Growth & Marketing ---------- */

  // Link in Bio — a profile page of link buttons.
  links: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="3" />
      <circle cx="12" cy="7.5" r="2" />
      <rect x="7.5" y="12" width="9" height="2.5" rx="1.25" />
      <rect x="7.5" y="16.5" width="9" height="2.5" rx="1.25" />
    </>
  ),

  // URL Shortener — a chain link.
  shortener: (
    <>
      <path d="M9.5 17H7.5a5 5 0 0 1 0-10h2" />
      <path d="M14.5 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </>
  ),

  // Waitlist — a clipboard of signups.
  waitlist: (
    <>
      <rect x="4.5" y="4.5" width="15" height="16.5" rx="2.5" />
      <rect x="9" y="2.5" width="6" height="4" rx="1.5" />
      <path d="M8.5 11.5h7" />
      <path d="M8.5 15.5h4.5" />
    </>
  ),

  // QR Codes — finder squares and a data run.
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
      <path d="M14 14h3.5" />
      <path d="M20.5 14v3.5" />
      <path d="M14 17.5v3" />
      <path d="M17.5 20.5h3" />
    </>
  ),

  // Newsletter — an envelope.
  newsletter: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 7.4l7.2 5.1a2.2 2.2 0 0 0 2.6 0l7.2-5.1" />
    </>
  ),

  // Site Builder — a browser frame with one content block.
  sites: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8.5h19" />
      <path d="M5.5 6.25h.01" />
      <path d="M8 6.25h.01" />
      <rect x="5.5" y="11" width="13" height="6" rx="1.5" />
    </>
  ),

  // Booking — a calendar with a confirmed slot.
  booking: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 2.75V6.5" />
      <path d="M16 2.75V6.5" />
      <path d="M9 15.5l2 2 4-4" />
    </>
  ),

  // Mini CRM — contacts.
  crm: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.25 20a6.25 6.25 0 0 1 12.5 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18.25 14.4A6.25 6.25 0 0 1 21 20" />
    </>
  ),

  // Changelog — a megaphone.
  changelog: (
    <>
      <path d="M4 10.2v3.6a1 1 0 0 0 .74.97L20 19V5L4.74 9.23A1 1 0 0 0 4 10.2z" />
      <path d="M8.5 15.6V19a2.25 2.25 0 0 0 4.34.82" />
    </>
  ),

  // Business Card — a landing card with a portrait.
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8.5" cy="10.75" r="2" />
      <path d="M5.5 16a3.6 3.6 0 0 1 6 0" />
      <path d="M14.5 10h4" />
      <path d="M14.5 13.5h4" />
    </>
  ),

  // Blog — a folded newspaper.
  blog: (
    <>
      <rect x="2.5" y="5" width="15" height="15" rx="2.5" />
      <path d="M17.5 9h2a2 2 0 0 1 2 2v6.5a2.5 2.5 0 0 1-2.5 2.5" />
      <rect x="5.5" y="8" width="5" height="4.5" rx="1.25" />
      <path d="M13 8.75h1.5" />
      <path d="M13 12h1.5" />
      <path d="M5.5 16h9" />
    </>
  ),

  /* ---------- Productivity & Organization ---------- */

  // Notes — a page under a pen.
  notes: (
    <>
      <path d="M12.5 3.5H5.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" />
      <path d="M18.1 2.9a2 2 0 0 1 2.8 2.83L12.9 13.7l-3.65.85.85-3.65z" />
    </>
  ),

  // Bookmarks — a pennant.
  bookmarks: (
    <path d="M18.5 20.5l-6.5-4.3-6.5 4.3V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2z" />
  ),

  // Read Later — an open book.
  readlater: (
    <>
      <path d="M12 7v13.5" />
      <path d="M12 7c-1.5-1.6-3.4-2.2-7-2.2H3.5v13H5.2c3 0 5.2.5 6.8 1.9" />
      <path d="M12 7c1.5-1.6 3.4-2.2 7-2.2h1.5v13h-1.7c-3 0-5.2.5-6.8 1.9" />
    </>
  ),

  // Tasks — a checklist with one item done.
  tasks: (
    <>
      <rect x="3" y="4.5" width="6" height="6" rx="1.5" />
      <path d="M3 17.5l2 2 4-4.5" />
      <path d="M12.5 7.5h8.5" />
      <path d="M12.5 17.5h8.5" />
    </>
  ),

  // Time Tracker — a stopwatch.
  time: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.75v3.75h2.75" />
      <path d="M9.5 2.5h5" />
      <path d="M12 2.5V6" />
    </>
  ),

  // Resume — a document with a portrait.
  resume: (
    <>
      <path d="M13.75 2.75H7a2 2 0 0 0-2 2v14.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M13.75 2.75V8H19" />
      <circle cx="12" cy="12.75" r="1.8" />
      <path d="M8.8 18a3.4 3.4 0 0 1 6.4 0" />
    </>
  ),

  // Job Tracker — a briefcase.
  jobs: (
    <>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
      <path d="M2.5 12.75h19" />
    </>
  ),

  // Workout Log — a dumbbell.
  workouts: (
    <>
      <path d="M6.5 6.5v11" />
      <path d="M3.75 9v6" />
      <path d="M17.5 6.5v11" />
      <path d="M20.25 9v6" />
      <path d="M6.5 12h11" />
    </>
  ),

  // Sticky Note Board — a note with a turned corner.
  whiteboard: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h11a2 2 0 0 1 2 2v8.5l-6 6h-7a2 2 0 0 1-2-2z" />
      <path d="M19.5 14h-4a1.5 1.5 0 0 0-1.5 1.5v4" />
    </>
  ),

  // Habit Tracker — a streak flame.
  habits: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),

  // Focus Timer — a target.
  focus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),

  // Snippet Manager — code.
  snippets: (
    <>
      <path d="M8.25 8L4.5 12l3.75 4" />
      <path d="M15.75 8L19.5 12l-3.75 4" />
      <path d="M13.25 5.5l-2.5 13" />
    </>
  ),

  // Kanban — three columns.
  kanban: (
    <>
      <rect x="3" y="3.5" width="5.5" height="12" rx="1.75" />
      <rect x="9.5" y="3.5" width="5.5" height="17" rx="1.75" />
      <rect x="16" y="3.5" width="5" height="8" rx="1.75" />
    </>
  ),

  // Timezone Planner — a globe.
  timezones: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.25a13.5 13.5 0 0 1 0 17.5 13.5 13.5 0 0 1 0-17.5z" />
    </>
  ),

  // RSS Reader — broadcast arcs.
  rss: (
    <>
      <path d="M4.5 11.5a8 8 0 0 1 8 8" />
      <path d="M4.5 4.5a15 15 0 0 1 15 15" />
      <circle cx="5.25" cy="18.75" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),

  // Recipe Box — fork and knife.
  recipes: (
    <>
      <path d="M4 3v5.5a2.5 2.5 0 0 0 2.5 2.5h1A2.5 2.5 0 0 0 10 8.5V3" />
      <path d="M7 11v10" />
      <path d="M20 14.5V4a4.5 4.5 0 0 0-4.5 4.5v4a2 2 0 0 0 2 2z" />
      <path d="M20 14.5V21" />
    </>
  ),

  /* ---------- Forms & Documents ---------- */

  // Forms — fields and a submit control.
  forms: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <rect x="7" y="7.5" width="10" height="2.5" rx="1.25" />
      <rect x="7" y="11.75" width="10" height="2.5" rx="1.25" />
      <path d="M7 17.25h4.5" />
    </>
  ),

  // Testimonials — a wall of love.
  testimonials: (
    <path d="M19 13.75c1.45-1.42 2.9-3.12 2.9-5.35A5.35 5.35 0 0 0 16.55 3c-1.7 0-2.92.48-4.55 2.03C10.37 3.48 9.15 3 7.45 3A5.35 5.35 0 0 0 2.1 8.4c0 2.23 1.45 3.93 2.9 5.35L12 20.7z" />
  ),

  // Feedback Board — an upvote.
  feedback: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M12 16V8.5" />
      <path d="M8.75 11.75L12 8.5l3.25 3.25" />
    </>
  ),

  // PDF Tools — a document, split.
  pdf: (
    <>
      <path d="M13.75 2.75H7a2 2 0 0 0-2 2v14.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M13.75 2.75V8H19" />
      <path d="M8 14.5h8" />
      <path d="M12 10.75v1.5" />
      <path d="M12 16.75v1.5" />
    </>
  ),

  // Diagrams — a flow of nodes.
  diagrams: (
    <>
      <rect x="9" y="2.75" width="6" height="5" rx="1.5" />
      <rect x="2.5" y="16.25" width="6" height="5" rx="1.5" />
      <rect x="15.5" y="16.25" width="6" height="5" rx="1.5" />
      <path d="M12 7.75v3.5" />
      <path d="M5.5 16.25v-3a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v3" />
    </>
  ),

  // Screen Recorder — a display, recording.
  screenrecorder: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <circle cx="12" cy="10.5" r="2.5" />
      <path d="M12 17v3.5" />
      <path d="M8.5 20.5h7" />
    </>
  ),

  // Wiki & Docs — a shelf of docs.
  wiki: (
    <>
      <rect x="3" y="4.5" width="4.5" height="15.5" rx="1.5" />
      <rect x="8.75" y="4.5" width="4.5" height="15.5" rx="1.5" />
      <path d="M15.4 6.4l3.4-.95a1 1 0 0 1 1.23.7l3 11.6a1 1 0 0 1-.7 1.2l-3.4.95z" />
    </>
  ),

  // Polls — results, live.
  polls: (
    <>
      <rect x="3.25" y="4.5" width="14" height="4" rx="2" />
      <rect x="3.25" y="10" width="8.5" height="4" rx="2" />
      <rect x="3.25" y="15.5" width="17.5" height="4" rx="2" />
    </>
  ),

  /* ---------- Analytics & Monitoring ---------- */

  // Uptime Monitor — a heartbeat.
  uptime: <path d="M2.5 12h4l2.5-6.5 4.5 13 2.5-6.5h4" />,

  // Site Analytics — bars on an axis.
  siteanalytics: (
    <>
      <path d="M3.5 3.5v14a3 3 0 0 0 3 3h14" />
      <path d="M8.5 17.5v-4" />
      <path d="M13 17.5v-8.5" />
      <path d="M17.5 17.5v-6" />
    </>
  ),

  // SEO Checker — auditing a page.
  seochecker: (
    <>
      <path d="M14.5 3.25H7a2 2 0 0 0-2 2v13.5a2 2 0 0 0 2 2h3.5" />
      <circle cx="16" cy="14" r="4.25" />
      <path d="M19.1 17.1l2.4 2.4" />
    </>
  ),

  // Webhook Relay — a payload rerouted.
  webhooks: (
    <>
      <path d="M17.5 16.75h-5.75c-1.05 0-1.87.9-2.38 1.82a3.85 3.85 0 0 1-7.12-1.57 3.9 3.9 0 0 1 .55-1.92" />
      <path d="M6 16.75l3-5.55c.51-.93.1-2.1-.48-2.98a3.85 3.85 0 1 1 6.62-3.9" />
      <path d="M12 6.25l3 5.5c.51.93 1.7 1.22 2.76 1.22a3.85 3.85 0 0 1 0 7.7" />
    </>
  ),

  // Status Page — component states.
  statuspage: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <circle cx="7" cy="9.25" r="1.15" fill="currentColor" stroke="none" />
      <path d="M10.5 9.25h7" />
      <circle cx="7" cy="14.75" r="1.15" fill="currentColor" stroke="none" />
      <path d="M10.5 14.75h7" />
    </>
  ),

  /* ---------- AI & Voice ---------- */

  // AI Writer — generated copy.
  writer: (
    <>
      <path d="M11 3.5l1.55 4.2 4.2 1.55-4.2 1.55L11 15l-1.55-4.2-4.2-1.55 4.2-1.55z" />
      <path d="M18 14.5l.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75z" />
    </>
  ),

  // Meeting Notes — a conversation, transcribed.
  meetingnotes: (
    <>
      <path d="M20.5 11.75a8 8 0 0 1-11.6 7.15L3.5 20.5l1.6-5.4a8 8 0 1 1 15.4-3.35z" />
      <path d="M9 10.5v3" />
      <path d="M12 8.75v6.5" />
      <path d="M15 10.5v3" />
    </>
  ),

  // Voice Notes — a microphone.
  voicenotes: (
    <>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.75a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18.25v3.25" />
    </>
  ),

  // AI Chat Widget — an assistant.
  chatwidget: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="3.5" />
      <path d="M12 4.75V7.5" />
      <circle cx="12" cy="3.5" r="1.25" />
      <path d="M8.75 12.5v1.75" />
      <path d="M15.25 12.5v1.75" />
      <path d="M3.5 13h-1.75" />
      <path d="M20.5 13h1.75" />
    </>
  ),

  // Text to Speech — a speaker.
  tts: (
    <>
      <path d="M11.5 4.9L6.75 8.75H3.5a1 1 0 0 0-1 1v4.5a1 1 0 0 0 1 1h3.25l4.75 3.85a.6.6 0 0 0 1-.47V5.37a.6.6 0 0 0-1-.47z" />
      <path d="M15.75 9.5a3.75 3.75 0 0 1 0 5" />
      <path d="M18.5 6.75a7.5 7.5 0 0 1 0 10.5" />
    </>
  ),

  // Writing Checker — prose, checked.
  writingchecker: (
    <>
      <path d="M4 6.5h16" />
      <path d="M4 11.5h10" />
      <path d="M4 16.5h5.5" />
      <path d="M13 17.25l2.25 2.25L20 14.5" />
    </>
  ),

  /* ---------- Finance ---------- */

  // Invoicing — a torn receipt.
  invoicing: (
    <>
      <path d="M5.5 21.5V4.5A2 2 0 0 1 7.5 2.5h9a2 2 0 0 1 2 2v17l-3.25-1.8-3.25 1.8-3.25-1.8z" />
      <path d="M9 8.25h6" />
      <path d="M9 12.25h4" />
    </>
  ),

  // Portfolio Tracker — a trend line.
  portfolio: (
    <>
      <path d="M3.5 16.5L9 11l3.5 3.5L20.5 6.5" />
      <path d="M15.5 6.5h5v5" />
    </>
  ),

  // Expense Tracker — a wallet.
  expenses: (
    <>
      <path d="M21.5 10.25V8A2.5 2.5 0 0 0 19 5.5H5A2.5 2.5 0 0 0 2.5 8v8A2.5 2.5 0 0 0 5 18.5h14a2.5 2.5 0 0 0 2.5-2.5v-2.25" />
      <path d="M21.5 10.25h-3.75a1.75 1.75 0 0 0 0 3.5h3.75" />
    </>
  ),

  // Budget Envelopes — allocation.
  budget: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 3.25V12l6.2 6.2" />
    </>
  ),

  /* ---------- Design & Media ---------- */

  // Color Palettes — swatches.
  palettes: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" />
      <circle cx="16.75" cy="16.75" r="3.75" />
    </>
  ),

  // Image Compressor — corners pulled in.
  compress: (
    <>
      <path d="M9.5 3.5v4a2 2 0 0 1-2 2h-4" />
      <path d="M14.5 3.5v4a2 2 0 0 0 2 2h4" />
      <path d="M9.5 20.5v-4a2 2 0 0 0-2-2h-4" />
      <path d="M14.5 20.5v-4a2 2 0 0 1 2-2h4" />
    </>
  ),

  // Screenshot Beautifier — an image, dressed up.
  shots: (
    <>
      <rect x="2.5" y="4.75" width="15" height="15" rx="3" />
      <circle cx="7.25" cy="9.75" r="1.5" />
      <path d="M2.9 16.6l4-4a2 2 0 0 1 2.83 0l5.6 5.6" />
      <path d="M19.25 2.5l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15-2.15-.85 2.15-.85z" />
    </>
  ),
};

/** Anything unmapped still gets a real shape, never a blank box. */
const FALLBACK = (
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>
);

export type ToolIconProps = {
  /** Tool slug from `src/lib/tools.ts`. */
  slug: string;
  className?: string;
  /** Rendered box in px. Stroke stays optically 1px at 16–24. */
  size?: number;
};

export default function ToolIcon({ slug, className, size = 18 }: ToolIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[slug] ?? FALLBACK}
    </svg>
  );
}

/* ------------------------------------------------------------------
   Interface icons — same pen, for the chrome around the tools. Keeps
   ✕ / ⌕ / ▶ / → glyphs (which shift between platforms exactly the way
   emoji do) out of the UI.
   ------------------------------------------------------------------ */

const UI: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8l4 4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  chevronRight: <path d="M9.5 5.5l6 6.5-6 6.5" />,
  arrowRight: (
    <>
      <path d="M4.5 12h14" />
      <path d="M13 6.5l5.5 5.5-5.5 5.5" />
    </>
  ),
  spark: (
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
  ),
  layers: (
    <>
      <path d="M12 3l8.5 4.5L12 12 3.5 7.5z" />
      <path d="M3.5 12.5L12 17l8.5-4.5" />
    </>
  ),
};

export type UiIconName = keyof typeof UI;

export function UiIcon({
  name,
  className,
  size = 16,
}: {
  name: UiIconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {UI[name]}
    </svg>
  );
}
