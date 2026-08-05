# VibeBundl — roadmap

Domain: **vibebundl.com** (bought, on Cloudflare, active)
Product: 53 tools · one login · one $19.99/mo Stripe subscription
Built from the community verdicts on canivibecodeit.com (credited, **not affiliated**)

---

## ✅ Done

- 53 tools built, type-clean, production build passing
- Supabase: 70 tables, RLS + policies on every one
- Stripe: "The Bundle" product @ $19.99/mo, restricted key, checkout + webhook wired
- Anthropic key working (AI Writer, Meeting Notes, Chat Widget)
- Resend key wired — **Newsletter actually sends email now**
- Uptime **auto-checks via Vercel Cron** every 5 min
- Security fixes: cross-tenant leak, SSRF on 3 routes, redirect-bypass, NOT NULL inserts
- Design system overhaul (surfaces, hairlines, type scale, focus rings, reduced-motion)
- Emoji → 53 hand-drawn SVG icons (`src/components/ToolIcon.tsx`)
- Sidebar nav for 53 tools (collapsible categories) + mobile nav sheet
- Rebranded to VibeBundl
- Test account: `qa-tester@wevibecodedit.test` / `TestBundle2026!` (subscription pre-granted)

---

## 🔥 The big new idea — "Request a tool"

**Users submit a SaaS they want vibecoded. We build it free and add it to the bundle.**

This is the growth loop. It makes the catalog community-owned, gives people a reason to
come back, and turns "53 tools" into "53 and climbing."

Build:
- [ ] Public `/request` page — submit: SaaS name, URL, what it costs, why you want it,
      **self-rated vibecode difficulty 1–10**, optional email for "we built it" notification
- [ ] Table `tool_requests` (+ `tool_request_votes`) with public insert, public read,
      owner-only moderation. Same RLS pattern as the feedback board.
- [ ] Public board showing requests sorted by votes, with status:
      `requested → planned → building → shipped`
- [ ] Upvote via security-definer RPC (same as `increment_feedback_vote`) + localStorage soft guard
- [ ] Admin moderation view (approve / set status / link to the shipped tool)
- [ ] Spam protection — this is a public write endpoint. Rate limit by IP, honeypot field,
      minimum content length. **Do not skip this.**
- [ ] Landing page CTA: "Don't see your subscription? We'll build it. Free."

Open questions to decide:
- Filter/rank by: votes? difficulty? price of the SaaS being replaced? (suggest: votes primary,
  show difficulty + price as metadata)
- Do we commit to a timeline, or explicitly "no promises, we build what gets voted up"?
  (suggest: the latter — never promise a ship date you can't hold)

---

## 📄 Per-tool pages (mirror canivibecodeit's structure)

One page per tool at `/tools/[slug]`. This is our biggest SEO surface — 53 pages of
long-tail "can I vibecode X" / "X alternative" traffic.

Each page needs:
- [ ] **The prompt** we used to build it — displayed in full, with `copy prompt` +
      `open in Claude Code` / `open in Codex` / `open in Cursor` buttons.
      Make ours *more elaborate* than his (that's the differentiator — his is a starting
      point, ours is the actual spec that produced a working tool).
- [ ] **What you lose** — honest list (sync, mobile app, integrations, support…)
- [ ] **Why people still pay** — honest paragraph
- [ ] **Prior art** — link open-source alternatives (see the Alex tweet note below)
- [ ] **Price / you'd save / build time / category** stat row
- [ ] **FAQ accordion** — "Can I vibecode X?", "How much does X cost?",
      "What do I lose by replacing X?", "Is there an open-source alternative?"
- [ ] **Share on X** button with prefilled text
- [ ] **"Also replaceable"** cross-links to 3 sibling tools (internal linking = SEO)
- [ ] `generateStaticParams` + per-page metadata/OG so all 53 are statically rendered

---

## 🎨 Landing page additions

- [ ] **Stats section** — like his (views, visitors, tools, requests). Ours must be
      **real numbers pulled from our own DB**, never invented. Use the Site Analytics
      tool we already built to track our own site — dogfooding, and it's a selling point.
- [ ] **FAQ section**
- [ ] **Share on X** buttons
- [ ] **"53 tools — and more coming"** messaging + link to the request page
- [ ] **Sponsor page** `/sponsor` — slots, pricing, timeline, testimonials
      (his: $2,500–$2,999/slot, 10 slots). Decide our pricing once we have traffic —
      **don't publish sponsor stats we don't have yet.**
- [ ] Sponsor rails on the site (left/right cards like his) once slots are sold
- [ ] Newsletter capture — "every week, more subscriptions die" style.
      **We already have Resend wired**, so this can be real on day one.

---

## 🎨 Design decisions still open

- [x] **Colour direction — RESOLVED.** Green accent + Space Grotesk / JetBrains Mono, matching
      canivibecodeit's palette and type pairing, but our own layout and structure. Surfaces
      retuned from a blue cast to near-neutral so green stays the only saturated colour.
- [x] **Category colours** — 7 hues (teal → amber), deliberately skipping green and red so
      those keep meaning "accent/state" and "destructive". Used at ~10% behind icons and as
      section dots.
- [x] **Accent picker** — users can re-tint the whole app via `data-accent`; green is default
      and renders byte-identical for anyone who never opens Settings.
- [ ] Icons: done, but review all 53 for clarity at 18px
- [ ] Light mode? (his has a toggle) — low priority

---

## 🚀 Launch blockers

- [x] **Deployed to Vercel** — live, project `vibebundl`
- [x] **vibebundl.com live** — Cloudflare A records (root + www) → 76.76.21.21, DNS-only,
      valid Let's Encrypt cert
- [x] All 11 env vars set across production / preview / development
- [x] **Stripe webhook registered** against the live URL with a real signing secret
      (`we_1U183tJFxLWMmpGoAm0VpviZ`) — the paid → access loop is closed
- [x] Verified live: `/` 200 · `/login` 200 · `/dashboard` 307→login ·
      webhook 400 on unsigned · cron 401 on unauthorized · checkout creates a real
      `cs_live_` session at $19.99/mo

Still open:
- [ ] **Click through all 53 tools as a real user.** They compile, deploy, and the security
      gates hold — individual tool behaviour is still unverified. An 11-agent audit pass has
      run over the code; a human pass is still worth doing. Test account:
      `qa-tester@wevibecodedit.test` / `TestBundle2026!` (subscription pre-granted, no payment)
- [ ] Put one real card through checkout end-to-end
- [ ] Verify a Resend sending domain (currently `onboarding@resend.dev`, testing-only).
      You own vibebundl.com now — this is a 5-minute job.
- [ ] **Cron is daily (`0 8 * * *`), not 5-minutely** — Hobby rejects sub-daily cron outright.
      On Pro, change the schedule back to `*/5 * * * *`; the endpoint already honours each
      monitor's own `interval_minutes`, so nothing else moves.
- [ ] Legal pages: Terms, Privacy (you're taking real payments — these aren't optional)

---

## ❓ Your questions, answered

**"Should we mention which SaaS we made our own versions of?"**
Yes — and we already do ("replaces Linktree Pro"). This is nominative fair use and it's
the entire value proposition; hiding it would make the product incomprehensible. Rules to
stay safe:
- Describe, never impersonate: "replaces X" ✅ / "X" as our product name ❌
- **No third-party logos** — our own icons only (already done)
- Never imply endorsement or partnership by those companies
- Keep prices accurate and dated — stale pricing claims are the actual legal risk
- Never copy their copy, screenshots, or UI

**The Alex tweet ("prior art — use these instead of building")**
He's right, and it's the strongest trust signal on the site. Worth stealing the *spirit*
even though it seems to argue against us: on a **per-tool page**, listing the open-source
alternative costs us nothing (someone who'd self-host was never going to pay $19.99) and
buys enormous credibility with exactly the audience that's suspicious of a 53-tool bundle.
Put it on the tool pages, **not** the pricing page. Our pitch isn't "this is the only way" —
it's "you don't want to run 53 self-hosted apps."

---

## 💡 Slogan / hero candidates

- **"53 subscriptions the internet said you could vibecode away. So we did."** (current)
- "You're not paying for software. You're paying 53 invoices." (current, on pricing)
- "One prompt away from free. We already ran the prompt."
- "$860 a month, or $19.99. Same tools."
- "The death list, shipped."
- "Cancel everything. Keep the tools."
- "Every week, more subscriptions die." (newsletter)
- "Don't see yours? We'll build it. Free." (request feature)
- "53 tools. One bill. More coming."

---

## 🔒 Security note

The Anthropic, Supabase service-role, Stripe, and Resend keys are all in this chat
transcript. You said you're not rotating them — your call, but **rotate before you make
this repo public or share the transcript.** The Supabase service-role key in particular
bypasses every RLS policy we wrote.

---

## 📓 From the handwritten notes (Aug 5)

### Done
- **Font exactly like canivibecodeit.com** — Space Grotesk + JetBrains Mono, shipped.
- **Stripe works?** — verified in production: real `cs_live_` session at $19.99/mo, webhook
  registered and rejecting unsigned calls. Still worth putting one real card through yourself.
- **Hero: "more upcoming, you choose which"** — shipped. Also added "every tool we add is
  included" to the trust line.

### Decided: do
- **Let clients submit which SaaS we add** — the growth loop. Highest priority build.
- **GSC** — yes, needed for the 53 tool pages' SEO.
- **Google Analytics** — NO. We sell a privacy-friendly analytics tool; running GA on our own
  site undercuts the pitch and triggers EU cookie-banner obligations. Dogfood our own Site
  Analytics tool instead — better marketing, no banner.
- **MCP server** — expose the 53 tools as MCP so Claude Code / Cursor can call them. Nobody
  else in this space has this. Real differentiation and it delivers the "agentic" positioning.
  Rank above building tool #54.

### Decided: think first
- **Open source** — the biggest call on the page, and it cuts against the business.
  canivibecodeit can be open source because it's a *directory*; giving away the code costs
  nothing. VibeBundl **is** the product — open-source it and anyone self-hosts free, so you're
  selling hosting to the exact crowd that likes self-hosting. Viable (Plausible, Cal.com, Ghost)
  but only with an open-core split decided UP FRONT. Don't half-do it.
  → Note: putting "GitHub" in the nav *implies* open source to this audience. A private repo
    link would read as bait-and-switch. Decide the license before adding the nav item.
- **Lifetime pricing** — recommend NO, or hard-capped. Marginal cost per user is not zero
  (Anthropic API on 3 tools, Supabase, Resend, Vercel). Lifetime = collect once, pay to serve
  forever. Classic indie trap: great launch week, underwater by month eight. If you want the
  spike, do a clearly-capped founding-member tier (first 100), not open-ended lifetime.
- **Free tier** — if any, gate by *tool count* (e.g. 3 tools free) rather than usage, so the
  AI-backed tools (real per-call cost) stay behind the paywall.

### Decided: change the approach
- **Scan canivibecodeit.com to auto-add most-vibecoded SaaS** — right instinct (his vote data
  is a genuine demand signal), risky method. Scraping a named adjacent site to feed a paid
  competing product is the one move that flips a friendly homage into a public fight — and he
  has the bigger audience right now.
  → **Just ask him.** He's active in the thread, his site is open source, and there's an
    obvious trade: we send sponsor traffic + attribution, he shares data or an affiliate deal.
    A partnership beats a scraper and costs one DM.
