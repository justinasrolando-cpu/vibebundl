export const CATEGORIES = [
  "Growth & Marketing",
  "Analytics & Monitoring",
  "Productivity & Organization",
  "AI & Voice",
  "Forms & Documents",
  "Design & Media",
  "Finance",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Short, stable key per category — the value of the `data-cat` attribute.
 *
 * No colour lives here. The key selects a `[data-cat="…"]` rule in
 * globals.css which publishes `--cat`; components read `--cat` and never
 * learn which hue they were handed. One place to retune the palette, and
 * category colour stays a design-system concern rather than a data one.
 */
export const CATEGORY_KEYS: Record<Category, string> = {
  "Growth & Marketing": "growth",
  "Analytics & Monitoring": "analytics",
  "Productivity & Organization": "productivity",
  "AI & Voice": "ai",
  "Forms & Documents": "forms",
  "Design & Media": "design",
  Finance: "finance",
};

export function categoryKey(category: Category): string {
  return CATEGORY_KEYS[category];
}

/**
 * A tool in the bundle. Iconography is not stored here: `slug` is the icon
 * key, and the drawing lives in `src/components/ToolIcon.tsx`. One source of
 * truth per concern, and no emoji in the data layer.
 */
export type Tool = {
  slug: string;
  name: string;
  replaces: string;
  description: string;
  originalPrice: number;
  category: Category;
};

export const TOOLS: Tool[] = [
  { slug: "links", name: "Link in Bio", replaces: "Linktree Pro", description: "One page for all your links, drag to reorder, public profile URL.", originalPrice: 9, category: "Growth & Marketing" },
  { slug: "shortener", name: "URL Shortener", replaces: "Bitly", description: "Short links with click analytics by day and referrer.", originalPrice: 35, category: "Growth & Marketing" },
  { slug: "waitlist", name: "Waitlist Pages", replaces: "LaunchList", description: "Public waitlist landing page with email capture and CSV export.", originalPrice: 15, category: "Growth & Marketing" },
  { slug: "qr", name: "QR Codes", replaces: "QR Tiger", description: "Generate and save QR codes for any URL or text, download as PNG/SVG.", originalPrice: 15, category: "Growth & Marketing" },
  { slug: "newsletter", name: "Newsletter", replaces: "Buttondown", description: "Manage subscribers and send campaigns.", originalPrice: 9, category: "Growth & Marketing" },
  { slug: "notes", name: "Notes", replaces: "Bear Pro", description: "Markdown notes with tags and full-text search.", originalPrice: 3, category: "Productivity & Organization" },
  { slug: "bookmarks", name: "Bookmarks", replaces: "Pinboard", description: "Save and tag links with auto-fetched titles.", originalPrice: 3, category: "Productivity & Organization" },
  { slug: "readlater", name: "Read Later", replaces: "Instapaper", description: "Save articles and track read/unread status.", originalPrice: 6, category: "Productivity & Organization" },
  { slug: "tasks", name: "Tasks", replaces: "Todoist", description: "To-dos with due dates, priority, and projects.", originalPrice: 7, category: "Productivity & Organization" },
  { slug: "time", name: "Time Tracker", replaces: "Rize", description: "Start/stop timers per project with daily and weekly summaries.", originalPrice: 17, category: "Productivity & Organization" },
  { slug: "forms", name: "Forms", replaces: "Wufoo", description: "Build forms, share a public link, collect and export responses.", originalPrice: 19, category: "Forms & Documents" },
  { slug: "testimonials", name: "Testimonials", replaces: "Senja", description: "Collect testimonials with a public form, approve, embed a wall of love.", originalPrice: 25, category: "Forms & Documents" },
  { slug: "feedback", name: "Feedback Board", replaces: "Frill / Upvoty", description: "Public board for feature requests with upvotes and status.", originalPrice: 29, category: "Forms & Documents" },
  { slug: "uptime", name: "Uptime Monitor", replaces: "Cronitor", description: "Check whether your URLs are up and keep a history of every check.", originalPrice: 10, category: "Analytics & Monitoring" },
  { slug: "sites", name: "Site Builder", replaces: "Carrd", description: "Publish a simple one-page site from content blocks.", originalPrice: 2, category: "Growth & Marketing" },
  { slug: "resume", name: "Resume Builder", replaces: "Novoresume", description: "Build a resume with live preview and PDF export.", originalPrice: 20, category: "Productivity & Organization" },
  { slug: "jobs", name: "Job Tracker", replaces: "Huntr", description: "Kanban board for job applications with notes per stage.", originalPrice: 40, category: "Productivity & Organization" },
  { slug: "pdf", name: "PDF Tools", replaces: "iLovePDF", description: "Merge, split, and compress PDFs in the browser.", originalPrice: 9, category: "Forms & Documents" },
  { slug: "diagrams", name: "Diagrams", replaces: "Mermaid Chart", description: "Write Mermaid syntax, see a live rendered diagram, export as SVG/PNG.", originalPrice: 0, category: "Forms & Documents" },
  { slug: "writer", name: "AI Writer", replaces: "Rytr", description: "Generate headlines, emails, and ad copy from a template and prompt.", originalPrice: 9, category: "AI & Voice" },
  { slug: "meetingnotes", name: "Meeting Notes", replaces: "Granola", description: "Live transcript while you talk, AI summary when you're done.", originalPrice: 14, category: "AI & Voice" },
  { slug: "voicenotes", name: "Voice Notes", replaces: "Wispr Flow / Superwhisper", description: "Dictate straight to text in the browser, no typing.", originalPrice: 15, category: "AI & Voice" },
  { slug: "chatwidget", name: "AI Chat Widget", replaces: "Chatbase", description: "Embeddable support chatbot trained on your own knowledge base.", originalPrice: 150, category: "AI & Voice" },
  { slug: "invoicing", name: "Invoicing", replaces: "Invoice Ninja", description: "Clients, line-item invoices, and PDF export.", originalPrice: 14, category: "Finance" },
  { slug: "siteanalytics", name: "Site Analytics", replaces: "Plausible, Umami, Simple Analytics, DataFast", description: "Privacy-friendly pageview analytics for any site, one script tag.", originalPrice: 20, category: "Analytics & Monitoring" },
  { slug: "seochecker", name: "SEO Checker", replaces: "Screaming Frog", description: "Audit a page's title, meta, headings, and links in seconds.", originalPrice: 22, category: "Analytics & Monitoring" },
  { slug: "webhooks", name: "Webhook Relay", replaces: "n8n Cloud", description: "Catch a webhook, forward it somewhere else, keep a log.", originalPrice: 24, category: "Analytics & Monitoring" },
  { slug: "screenrecorder", name: "Screen Recorder", replaces: "Tella, Screen Studio", description: "Record your screen and download the clip, no install.", originalPrice: 13, category: "Forms & Documents" },
  { slug: "tts", name: "Text to Speech", replaces: "ElevenLabs", description: "Turn text into spoken audio using your browser's voices.", originalPrice: 22, category: "AI & Voice" },
  { slug: "portfolio", name: "Portfolio Tracker", replaces: "Portfolio Coach", description: "Track your holdings and cost basis. Tracking only, never advice.", originalPrice: 0, category: "Finance" },
  { slug: "expenses", name: "Expense Tracker", replaces: "Expensify", description: "Log expenses by category, see monthly totals.", originalPrice: 5, category: "Finance" },
  { slug: "booking", name: "Booking Page", replaces: "Calendly / Cal.com / SavvyCal", description: "Publish open time slots, let people book one. No calendar sync.", originalPrice: 12, category: "Growth & Marketing" },
  { slug: "workouts", name: "Workout Log", replaces: "Hevy Pro", description: "Log sets, reps, and weight per exercise, browse by day.", originalPrice: 3, category: "Productivity & Organization" },
  { slug: "whiteboard", name: "Sticky Note Board", replaces: "Whimsical / Excalidraw+", description: "Drag sticky notes around a freeform board and save the layout.", originalPrice: 12, category: "Productivity & Organization" },
  { slug: "statuspage", name: "Status Page", replaces: "Better Stack / UptimeRobot", description: "A public status page for the monitors in your Uptime Monitor tool.", originalPrice: 30, category: "Analytics & Monitoring" },
  { slug: "habits", name: "Habit Tracker", replaces: "Streaks / Habitica", description: "Check off daily habits and watch your streaks build.", originalPrice: 5, category: "Productivity & Organization" },
  { slug: "budget", name: "Budget Envelopes", replaces: "YNAB", description: "Envelope budgeting — set monthly limits, track what's left.", originalPrice: 14.99, category: "Finance" },
  { slug: "focus", name: "Focus Timer", replaces: "Session / Serene", description: "Pomodoro timer with a log of every session you complete.", originalPrice: 4, category: "Productivity & Organization" },
  { slug: "snippets", name: "Snippet Manager", replaces: "Pieces", description: "Save code snippets by language and tag, copy in one click.", originalPrice: 8, category: "Productivity & Organization" },
  { slug: "crm", name: "Mini CRM", replaces: "Less Annoying CRM / Attio", description: "Track contacts through lead → contacted → customer.", originalPrice: 15, category: "Growth & Marketing" },
  { slug: "kanban", name: "Kanban Board", replaces: "Trello", description: "Drag cards across to-do, doing, and done.", originalPrice: 12.5, category: "Productivity & Organization" },
  { slug: "wiki", name: "Wiki & Docs", replaces: "Slite / Nuclino", description: "Write internal docs, publish any page to a public URL.", originalPrice: 10, category: "Forms & Documents" },
  { slug: "changelog", name: "Changelog", replaces: "Beamer", description: "Publish release notes your users can actually follow.", originalPrice: 49, category: "Growth & Marketing" },
  { slug: "polls", name: "Polls", replaces: "StrawPoll", description: "Ask one question, share a link, watch votes land live.", originalPrice: 9, category: "Forms & Documents" },
  { slug: "card", name: "Business Card", replaces: "Popl", description: "A digital business card page with a scannable QR code.", originalPrice: 6, category: "Growth & Marketing" },
  { slug: "timezones", name: "Timezone Planner", replaces: "World Time Buddy", description: "See your whole team's local time before you book a call.", originalPrice: 3, category: "Productivity & Organization" },
  { slug: "palettes", name: "Color Palettes", replaces: "Coolors", description: "Generate, lock, and save color palettes for your projects.", originalPrice: 5, category: "Design & Media" },
  { slug: "compress", name: "Image Compressor", replaces: "TinyPNG / Squoosh", description: "Shrink and resize images in your browser, nothing uploaded.", originalPrice: 4, category: "Design & Media" },
  { slug: "shots", name: "Screenshot Beautifier", replaces: "Shots.so / Xnapper", description: "Drop a screenshot on a gradient, round it off, export it.", originalPrice: 10, category: "Design & Media" },
  { slug: "rss", name: "RSS Reader", replaces: "Feedbin / Feedly / Inoreader", description: "Subscribe to feeds and read everything in one clean list.", originalPrice: 7, category: "Productivity & Organization" },
  { slug: "writingchecker", name: "Writing Checker", replaces: "Hemingway / LanguageTool", description: "Catch long sentences, passive voice, and filler as you type.", originalPrice: 19.9, category: "AI & Voice" },
  { slug: "blog", name: "Blog", replaces: "Ghost Pro", description: "Write posts, publish them to your own public blog page.", originalPrice: 35, category: "Growth & Marketing" },
  { slug: "recipes", name: "Recipe Box", replaces: "Paprika / AnyList", description: "Save recipes and build a grocery list from them.", originalPrice: 5, category: "Productivity & Organization" },
];

/** slug → Tool, so lookups off a stored list of slugs stay O(1). */
export const TOOLS_BY_SLUG: ReadonlyMap<string, Tool> = new Map(TOOLS.map((t) => [t.slug, t]));

/**
 * What marketing copy says out loud. Deliberately not `TOOLS.length`: "50+"
 * stays true as the catalogue grows and reads as a floor rather than a
 * ceiling, which is the point — the number only goes up. Use TOOLS.length
 * anywhere the exact count matters (the dashboard, the receipt).
 */
export const TOOL_COUNT_LABEL = "50+";

export const BUNDLE_PRICE_USD = 19.99;
export const TOTAL_ORIGINAL_PRICE = TOOLS.reduce((sum, t) => sum + t.originalPrice, 0);

/** Tools grouped by category, in CATEGORIES display order. Categories with no tools are omitted. */
export function groupToolsByCategory(tools: Tool[] = TOOLS): { category: Category; tools: Tool[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    tools: tools.filter((t) => t.category === category),
  })).filter((group) => group.tools.length > 0);
}
