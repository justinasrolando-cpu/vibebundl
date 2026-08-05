/**
 * What each tool actually does, and what you give up by switching to it.
 *
 * This file is the reason the product is credible. Anyone can list 53 logos
 * and claim to replace them; the interesting claim is the *specific* one —
 * here is the part we built, here is the part we didn't, decide for yourself.
 * A `loses` list that reads like marketing ("fewer integrations!") is worse
 * than no list at all, so every entry names a concrete thing a real user of
 * that product would miss on their first day.
 *
 * Rules for editing this file:
 *
 *  - `loses` is never empty. If a tool genuinely has no gaps, the tool is
 *    too small to be worth listing, not too good.
 *  - Name features, not adjectives. "No team round-robin" beats "less
 *    powerful for teams".
 *  - `openSource` is a project that actually exists and actually solves the
 *    same job. Leave it null rather than reaching — pointing someone at a
 *    dead repo costs more trust than admitting there isn't one.
 *  - Never soften a `loses` entry because it hurts the pitch. Someone who
 *    cancels a subscription they needed because we undersold the gap is a
 *    refund and a bad review; someone who reads the gap and subscribes
 *    anyway is a customer who stays.
 */
export type Tradeoff = {
  /** What our version does. Concrete capabilities, not benefits. */
  keeps: string[];
  /** What the product we replace has that we don't. Always populated. */
  loses: string[];
  /** A real open-source project doing the same job, if one exists. */
  openSource?: string;
};

export const TRADEOFFS: Record<string, Tradeoff> = {
  links: {
    keeps: ["Unlimited links, drag to reorder", "A public profile page at your own slug", "Click counts per link"],
    loses: ["Themes and custom fonts", "Built-in payments and tip jars", "The link-scheduling and A/B tools on Linktree's paid plans"],
    openSource: "LinkStack",
  },
  shortener: {
    keeps: ["Short links on your own domain path", "Clicks by day and by referrer", "Unlimited links"],
    loses: ["A branded short domain of your own", "QR analytics tied to each link", "Bitly's deep-link and mobile-app routing"],
    openSource: "Dub.co",
  },
  waitlist: {
    keeps: ["A public landing page with email capture", "CSV export of every signup", "A live signup count"],
    loses: ["Referral positions and leaderboards", "Automated invite waves", "Built-in email sequences to the list"],
  },
  qr: {
    keeps: ["QR for any URL or text", "PNG and SVG download at print resolution", "A saved history you can regenerate from"],
    loses: ["Dynamic QR codes you can re-point after printing", "Scan analytics", "Logo-in-the-middle and colour styling"],
  },
  newsletter: {
    keeps: ["Subscriber list with import and export", "Compose and send a campaign", "Open tracking"],
    loses: ["Automations and drip sequences", "Paid subscriptions", "A hosted archive page and RSS-to-email"],
    openSource: "Listmonk",
  },
  notes: {
    keeps: ["Markdown with live preview", "Tags and full-text search", "Everything syncs to your account"],
    loses: ["Offline-first native apps", "Handwriting and sketch notes", "Bear's cross-note linking and export formats"],
    openSource: "Joplin",
  },
  bookmarks: {
    keeps: ["Save a URL with the title fetched for you", "Tags and search", "Bulk export"],
    loses: ["A browser extension for one-click saving", "Full-page archiving, so a dead link stays readable", "Public bookmark feeds"],
    openSource: "linkding",
  },
  readlater: {
    keeps: ["Save articles, mark read or unread", "Clean reading list", "Search across everything saved"],
    loses: ["Full article text extraction and offline reading", "Highlights and notes on a passage", "Send-to-Kindle and mobile apps"],
    openSource: "Wallabag",
  },
  tasks: {
    keeps: ["Projects, due dates and priorities", "Fast keyboard entry", "Everything in one list you can filter"],
    loses: ["Natural-language dates (\"next tuesday 3pm\")", "Recurring tasks", "Mobile apps, widgets and reminders"],
    openSource: "Vikunja",
  },
  time: {
    keeps: ["Start/stop timers per project", "Daily and weekly totals", "Export for invoicing"],
    loses: ["Automatic tracking of what app you're in", "Focus scoring and coaching", "Calendar integration"],
    openSource: "Kimai",
  },
  forms: {
    keeps: ["Build a form, share a public link", "Responses table with CSV export", "Required fields and basic validation"],
    loses: ["Conditional logic and branching", "Payment fields", "File uploads and multi-page forms"],
    openSource: "Formbricks",
  },
  testimonials: {
    keeps: ["A public collection page for written testimonials", "Approve before anything shows", "Embed the approved wall"],
    loses: ["Video testimonials", "Auto-import from X, LinkedIn and G2", "Styled widget variants and carousels"],
  },
  feedback: {
    keeps: ["A public board where users post and vote", "Status per item", "Sorted by votes, so the loudest need is obvious"],
    loses: ["Roadmap columns and a changelog widget", "In-app embedded widgets", "Segmenting votes by customer value"],
    openSource: "Fider",
  },
  uptime: {
    keeps: ["HTTP checks on a schedule", "Response time and status history", "Manual check on demand"],
    loses: ["SMS and phone-call alerting", "Multi-region checks", "Sub-minute check intervals and on-call escalation"],
    openSource: "Uptime Kuma",
  },
  sites: {
    keeps: ["A one-page site at your own slug", "Sections, links and images", "Published instantly"],
    loses: ["A custom domain", "Templates and a visual drag editor", "Forms, analytics and SEO controls per page"],
  },
  resume: {
    keeps: ["Structured sections you fill in once", "Clean PDF export", "Multiple versions saved"],
    loses: ["A gallery of designed templates", "ATS scoring against a job description", "Cover-letter generation"],
    openSource: "Reactive Resume",
  },
  jobs: {
    keeps: ["Applications through stages, with notes and dates", "Everything in one board", "Export"],
    loses: ["Autofill from a job posting URL", "A browser extension that saves as you browse", "Resume tailoring and contact finding"],
  },
  pdf: {
    keeps: ["Merge, split and compress", "Runs in your browser — nothing is uploaded", "No page limits"],
    loses: ["OCR", "Convert to and from Word and Excel", "E-signatures and form filling"],
    openSource: "Stirling PDF",
  },
  diagrams: {
    keeps: ["Write Mermaid, see it render live", "Save named diagrams", "Export SVG and PNG"],
    loses: ["Real-time collaboration on one diagram", "AI-generated diagrams from a prompt", "Confluence and Jira embeds"],
    openSource: "Mermaid Live Editor",
  },
  writer: {
    keeps: ["Drafting, rewriting and tone shifts", "Long-form output, not just snippets", "Your drafts saved to your account"],
    loses: ["Dozens of pre-built use-case templates", "Brand-voice training on your own writing", "Team workspaces and plagiarism checking"],
  },
  meetingnotes: {
    keeps: ["Paste or type a transcript, get structured notes and actions", "Notes saved and searchable", "Works for any meeting, any platform"],
    loses: ["Automatic recording — it doesn't join your calls", "Speaker diarisation", "Calendar auto-attach and CRM sync"],
  },
  voicenotes: {
    keeps: ["Record in the browser, get a transcript", "Notes saved and searchable", "No install"],
    loses: ["System-wide dictation into any app", "Custom vocabulary and commands", "Sub-second latency of a native tool"],
    openSource: "Whisper",
  },
  chatwidget: {
    keeps: ["A chat bot trained on text you paste", "An embeddable widget for your site", "Conversation history"],
    loses: ["Crawling your whole site or uploading PDFs to train", "Handoff to a human agent", "Lead capture and CRM integrations"],
  },
  invoicing: {
    keeps: ["Invoices with line items, tax and totals", "PDF export and a public payment link", "Client list"],
    loses: ["Automatic payment collection and reconciliation", "Recurring invoices and dunning", "Multi-currency and full accounting"],
    openSource: "Invoice Ninja (self-hosted)",
  },
  siteanalytics: {
    keeps: ["A script tag, page views, referrers and countries", "Cookieless, so no consent banner", "Your data stays in your account"],
    loses: ["Funnels, goals and custom events", "Real-time visitor view", "Multi-site dashboards and team access"],
    openSource: "Umami",
  },
  seochecker: {
    keeps: ["Fetch a URL and check title, description, headings and links", "A prioritised issue list", "No install"],
    loses: ["Crawling an entire site, not one page", "Log-file and JavaScript rendering analysis", "Scheduled crawls and change tracking"],
  },
  webhooks: {
    keeps: ["A URL that receives webhooks, with the full payload logged", "Forward to another endpoint", "Replay a delivery"],
    loses: ["A visual workflow builder", "Hundreds of prebuilt app connectors", "Branching, retries with backoff and scheduling"],
    openSource: "n8n (self-hosted)",
  },
  screenrecorder: {
    keeps: ["Record your screen and camera in the browser", "Download the file", "Nothing uploaded to us"],
    loses: ["Automatic zoom and cursor smoothing", "Timeline editing and trimming", "Hosted sharing pages with view analytics"],
  },
  tts: {
    keeps: ["Type text, get spoken audio", "Several voices", "Download the audio file"],
    loses: ["Voice cloning from a sample", "Fine emotion and pacing controls", "The top tier of ElevenLabs' voice quality"],
    openSource: "Piper",
  },
  portfolio: {
    keeps: ["Track holdings and cost basis", "See allocation and total value", "Manual entry, so any asset works"],
    loses: ["Live price feeds and automatic broker sync", "Tax-lot reporting", "Any form of advice — this records, it does not recommend"],
    openSource: "Ghostfolio",
  },
  expenses: {
    keeps: ["Log expenses by category with receipts attached", "Monthly totals", "CSV export"],
    loses: ["Receipt OCR that reads the amount for you", "Corporate card feeds and approval workflows", "Mileage tracking and reimbursement runs"],
  },
  booking: {
    keeps: ["A public booking page with your availability", "Bookings land in your dashboard", "Timezone-aware slots"],
    loses: ["Google and Outlook calendar sync — this doesn't read your real calendar", "Team round-robin and routing", "SMS reminders and paid bookings"],
    openSource: "Cal.com",
  },
  workouts: {
    keeps: ["Log exercises, sets, reps and weight", "History per exercise", "Personal-record tracking"],
    loses: ["Native mobile apps and watch support", "An exercise library with form videos", "Programme templates and social feeds"],
  },
  whiteboard: {
    keeps: ["Sticky notes you can drag, colour and group", "Saved boards", "Shareable"],
    loses: ["Freehand drawing, shapes and connectors", "Real-time multiplayer cursors", "Templates and infinite-canvas navigation"],
    openSource: "Excalidraw",
  },
  statuspage: {
    keeps: ["A public status page tied to your monitors", "Incident posts with updates", "Component-level status"],
    loses: ["Subscriber notifications by email or SMS", "A custom domain", "Scheduled maintenance windows and SLA reporting"],
    openSource: "Cachet",
  },
  habits: {
    keeps: ["Daily habits with a streak count", "A calendar view of what you did", "Unlimited habits"],
    loses: ["Phone reminders and home-screen widgets", "Health-app integration", "Habitica's whole game layer"],
  },
  budget: {
    keeps: ["Envelope budgeting with monthly limits", "What's left, per envelope, at a glance", "Manual entry"],
    loses: ["Bank sync — you enter transactions yourself", "Goal tracking and age-of-money", "Shared household budgets and mobile apps"],
    openSource: "Actual Budget",
  },
  focus: {
    keeps: ["A Pomodoro timer with configurable intervals", "A log of every session", "Daily totals"],
    loses: ["Website and app blocking during a session", "Calendar integration", "Ambient sound and mobile apps"],
  },
  snippets: {
    keeps: ["Snippets by language and tag", "Search and one-click copy", "Syntax highlighting"],
    loses: ["IDE and editor extensions", "Automatic capture from your clipboard", "AI enrichment and related-snippet suggestions"],
    openSource: "massCode",
  },
  crm: {
    keeps: ["Contacts moving through lead → contacted → customer", "Notes and next steps per contact", "Export"],
    loses: ["Email sync, so conversations aren't logged automatically", "Pipelines with deal values and forecasting", "Team assignment and permissions"],
    openSource: "Twenty",
  },
  kanban: {
    keeps: ["Drag cards across to-do, doing and done", "Multiple boards", "Card descriptions and ordering"],
    loses: ["Multiple collaborators on one board", "Attachments, checklists and due dates", "Automation rules and integrations"],
    openSource: "Focalboard",
  },
  wiki: {
    keeps: ["Markdown docs in a page tree", "Publish any page to a public URL", "Full-text search"],
    loses: ["Real-time collaborative editing", "Comments and mentions", "Permissions per page and version history"],
    openSource: "Outline",
  },
  changelog: {
    keeps: ["Release notes on a public page", "Tag entries by type", "An RSS feed"],
    loses: ["An in-app widget with a what's-new badge", "Email announcements to your users", "Segmenting who sees which entry"],
  },
  polls: {
    keeps: ["One question, a share link, live results", "No account needed to vote", "Basic duplicate-vote protection"],
    loses: ["Multiple questions in one poll", "Ranked-choice and scheduling", "Embeddable poll widgets"],
  },
  card: {
    keeps: ["A digital business card page at your own slug", "A scannable QR code you can print", "Save-to-contacts on the public page"],
    loses: ["An NFC tag you tap against a phone", "Lead capture from people who scan you", "Team card management and templates"],
  },
  timezones: {
    keeps: ["Your team's local times side by side", "Find an hour that works for everyone", "Saved rosters"],
    loses: ["Calendar integration to see who's actually free", "Meeting scheduling from inside the tool", "Mobile apps and browser extensions"],
  },
  palettes: {
    keeps: ["Generate palettes, lock the colours you like", "Save them to your account", "Copy hex values"],
    loses: ["Contrast checking and accessibility scoring", "Extract a palette from an uploaded image", "Gradient and image-mockup export"],
  },
  compress: {
    keeps: ["Shrink and resize images", "Runs entirely in your browser — nothing uploaded", "Batch several at once"],
    loses: ["API access for automated pipelines", "AVIF and other newer output formats", "Smart cropping"],
    openSource: "Squoosh",
  },
  shots: {
    keeps: ["Drop a screenshot on a gradient, round the corners, export", "Several backgrounds and paddings", "PNG download"],
    loses: ["Device frames and 3D perspective", "Auto-balancing and annotation tools", "Batch processing"],
  },
  rss: {
    keeps: ["Subscribe to feeds, read everything in one list", "Mark read and unread", "OPML import"],
    loses: ["Offline reading and mobile apps", "Rules, filters and saved searches", "Newsletter-to-feed addresses"],
    openSource: "FreshRSS",
  },
  writingchecker: {
    keeps: ["Flags long sentences, passive voice, adverbs and filler", "Readability score", "Works as you type"],
    loses: ["Grammar and spelling correction", "Browser extension and editor plugins", "Style guides and tone rewriting"],
    openSource: "LanguageTool (self-hosted)",
  },
  blog: {
    keeps: ["Write posts, publish to your own public blog page", "Drafts and scheduling", "Markdown"],
    loses: ["A custom domain", "Paid memberships and newsletters to subscribers", "Themes, SEO controls and a full CMS"],
    openSource: "Ghost (self-hosted)",
  },
  recipes: {
    keeps: ["Save recipes with ingredients and steps", "Build a grocery list from them", "Search and tags"],
    loses: ["Import a recipe from a URL automatically", "Meal planning by week", "Mobile apps and shared household lists"],
    openSource: "Mealie",
  },
};

export function tradeoffFor(slug: string): Tradeoff | undefined {
  return TRADEOFFS[slug];
}
