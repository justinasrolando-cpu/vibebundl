# VibeBundl

53 small web tools behind one login and one $19.99/mo subscription, replacing
about $860/mo of separate SaaS.

Built from the community verdicts on [canivibecodeit.com](https://canivibecodeit.com)
about which subscriptions were one prompt away from unnecessary — an
independent project this one is not affiliated with or endorsed by.

**Live:** [vibebundl.com](https://vibebundl.com)

---

## What's actually here

Every tool is a route under `/dashboard`, gated by a single Stripe
subscription. There are no per-tool upsells and no seats: you have the bundle
or you don't.

The catalogue lives in exactly one place — [`src/lib/tools.ts`](src/lib/tools.ts).
The nav, the landing page, the sitemap, the OG card, the savings arithmetic
and the 53 marketing pages are all derived from it. Adding a tool means adding
a row there plus the route; nothing else needs to be told.

Its companion is [`src/lib/tradeoffs.ts`](src/lib/tradeoffs.ts), which records
what each tool *doesn't* do. That file is why the marketing is credible, and
it has one rule: `loses` is never empty. If a tool genuinely has no gaps, it's
too small to list — not too good.

## Stack

| | |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Styling | Tailwind v4, `@theme inline` over CSS custom properties |
| Data | Supabase — Postgres, Auth, Storage, RLS on every table |
| Payments | Stripe Checkout + Billing Portal, webhook-driven |
| Hosting | Vercel, plus a cron for the uptime sweep |
| Analytics | Vercel Analytics — cookieless, so there is no consent banner |

## Running it

```bash
npm install
cp .env.local.example .env.local   # then fill it in
npm run dev
```

Migrations in `supabase/migrations/` apply in filename order. They are
append-only: fix a mistake with a new file, never by editing an applied one.

## Things worth knowing before changing something

**RLS policies are permissive, and permissive means OR.** A table with both a
public `select using (true)` and an owner policy is readable by everyone — the
owner policy doesn't narrow it, it widens it. Every dashboard query carries an
explicit `.eq("user_id", …)` for exactly that reason. See
`supabase/migrations/0012_security_hardening.sql` for what happens when one
doesn't.

**`not null default ''` rejects an explicit `NULL`.** `field: value || null`
throws on insert; send `""`.

**A plain function exported from a `"use client"` module cannot be called on
the server.** It compiles, it builds, and it 500s at request time. That's why
`src/lib/accents.ts` exists separately from `AccentScope.tsx`.

**No component ever names a colour.** Components read `--accent` and `--cat`;
the values arrive from `data-accent` and `data-cat` attributes further up the
tree. That indirection is what lets the accent picker and the light theme
retint the whole app without touching a single component.

## Licence

Source-available, not open source — see [LICENSE](LICENSE). Read it, run it,
take pieces of it, send a PR. Don't run it as a competing paid service.

The brand assets at [/press](https://vibebundl.com/press) are free to use as
described there.
