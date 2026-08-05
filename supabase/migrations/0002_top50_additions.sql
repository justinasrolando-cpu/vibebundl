-- Additions covering more of canivibecodeit.com's top-50-by-votes list.
-- Same ownership model as 0001_init.sql: owner-only tables use
-- auth.uid() = user_id; public-facing tables get a narrow public policy.

-- ---------------------------------------------------------------------------
-- Meeting Notes (replaces Granola) -- live transcript captured client-side
-- via the browser's Web Speech API, summarized on save via the Anthropic API.
-- ---------------------------------------------------------------------------
create table meeting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled meeting',
  transcript text not null default '',
  summary text not null default '',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table meeting_notes enable row level security;
create policy "owner manages own meeting notes" on meeting_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Voice Notes / Dictation (replaces Wispr Flow, Superwhisper)
-- ---------------------------------------------------------------------------
create table voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  transcript text not null default '',
  created_at timestamptz not null default now()
);
alter table voice_notes enable row level security;
create policy "owner manages own voice notes" on voice_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Social Queue (replaces SuperX, Post Bridge, Postiz, FeedHive, Buffer,
-- Typefully, RADAAR) -- compose/schedule drafts. No live OAuth posting in
-- this MVP (each platform needs its own developer app approval).
-- ---------------------------------------------------------------------------
create table social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'x',
  content text not null,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'posted')),
  created_at timestamptz not null default now()
);
alter table social_posts enable row level security;
create policy "owner manages own social posts" on social_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- AI Chat Widget (replaces Chatbase, partially One Place) -- embeddable
-- support chatbot answering from an owner-provided knowledge base via the
-- Anthropic API.
-- ---------------------------------------------------------------------------
create table chat_bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null default 'Assistant',
  knowledge_base text not null default '',
  created_at timestamptz not null default now()
);
alter table chat_bots enable row level security;
create policy "public can view chat bots" on chat_bots for select using (true);
create policy "owner manages own chat bots" on chat_bots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references chat_bots(id) on delete cascade,
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
-- Deliberately no public insert/select policy: session_id is just a
-- client-generated id, not a real auth boundary, so a public SELECT policy
-- would let anyone read every visitor's conversation with every bot. All
-- public read/write for the widget goes through /api/chat/[slug]/route.ts
-- using the service-role admin client, scoped server-side to the session_id
-- the caller already holds.
create policy "owner reads own bot messages" on chat_messages for select
  using (exists (select 1 from chat_bots b where b.id = bot_id and b.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Invoicing (replaces Invoice Ninja)
-- ---------------------------------------------------------------------------
create table invoice_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);
alter table invoice_clients enable row level security;
create policy "owner manages own invoice clients" on invoice_clients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references invoice_clients(id) on delete set null,
  number text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  issue_date date not null default current_date,
  due_date date,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table invoices enable row level security;
create policy "owner manages own invoices" on invoices for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Site Analytics (replaces Plausible, Umami Cloud, Simple Analytics, DataFast)
-- ---------------------------------------------------------------------------
create table analytics_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  domain text not null default '',
  created_at timestamptz not null default now()
);
alter table analytics_sites enable row level security;
create policy "owner manages own analytics sites" on analytics_sites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references analytics_sites(id) on delete cascade,
  path text not null default '/',
  referrer text,
  created_at timestamptz not null default now()
);
alter table analytics_events enable row level security;
create policy "public can record pageview" on analytics_events for insert with check (true);
create policy "owner reads own analytics events" on analytics_events for select
  using (exists (select 1 from analytics_sites s where s.id = site_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- SEO Checker (replaces Screaming Frog SEO Spider, single-page audit only)
-- ---------------------------------------------------------------------------
create table seo_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  score int not null default 0,
  issues jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table seo_audits enable row level security;
create policy "owner manages own seo audits" on seo_audits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Webhook Relay (replaces n8n Cloud, minimal single-hop relay)
-- ---------------------------------------------------------------------------
create table webhook_relays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  target_url text not null,
  created_at timestamptz not null default now()
);
alter table webhook_relays enable row level security;
create policy "owner manages own webhook relays" on webhook_relays for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table webhook_logs (
  id uuid primary key default gen_random_uuid(),
  relay_id uuid not null references webhook_relays(id) on delete cascade,
  payload jsonb not null default '{}',
  forwarded_status int,
  created_at timestamptz not null default now()
);
alter table webhook_logs enable row level security;
create policy "owner reads own webhook logs" on webhook_logs for select
  using (exists (select 1 from webhook_relays r where r.id = relay_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Text to Speech (replaces ElevenLabs, browser speechSynthesis MVP)
-- ---------------------------------------------------------------------------
create table tts_snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
alter table tts_snippets enable row level security;
create policy "owner manages own tts snippets" on tts_snippets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Portfolio Tracker (replaces Portfolio Coach) -- manual holdings tracker
-- only. Does not fetch live prices and must never give investment advice.
-- ---------------------------------------------------------------------------
create table portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  quantity numeric not null default 0,
  cost_basis numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table portfolio_holdings enable row level security;
create policy "owner manages own portfolio holdings" on portfolio_holdings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Screen Recorder (replaces Tella, Screen Studio) is fully client-side
-- (MediaRecorder + getDisplayMedia, download only) -- no table needed.
