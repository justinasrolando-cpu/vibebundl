-- 14 more tools to reach 50. Same ownership model as earlier migrations:
-- owner-only tables use auth.uid() = user_id; public-facing tables get a
-- narrow public policy AND their dashboards must still filter by user_id
-- explicitly (permissive policies OR together).

-- ---------------------------------------------------------------------------
-- Habit Tracker (replaces Streaks / Habitica)
-- ---------------------------------------------------------------------------
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4ade80',
  created_at timestamptz not null default now()
);
alter table habits enable row level security;
create policy "owner manages own habits" on habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table habit_checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  done_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, done_on)
);
alter table habit_checkins enable row level security;
create policy "owner manages own habit checkins" on habit_checkins for all
  using (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Budget Envelopes (replaces YNAB)
-- ---------------------------------------------------------------------------
create table budget_envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_limit numeric not null default 0,
  period text not null default to_char(current_date, 'YYYY-MM'),
  created_at timestamptz not null default now()
);
alter table budget_envelopes enable row level security;
create policy "owner manages own envelopes" on budget_envelopes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Focus Timer / Pomodoro (replaces Session, Serene)
-- ---------------------------------------------------------------------------
create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  minutes int not null default 25,
  completed_at timestamptz not null default now()
);
alter table focus_sessions enable row level security;
create policy "owner manages own focus sessions" on focus_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Snippet Manager (replaces Pieces)
-- ---------------------------------------------------------------------------
create table snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  language text not null default 'text',
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table snippets enable row level security;
create policy "owner manages own snippets" on snippets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Mini CRM (replaces Less Annoying CRM / Attio)
-- ---------------------------------------------------------------------------
create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null default '',
  company text not null default '',
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'customer', 'lost')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table crm_contacts enable row level security;
create policy "owner manages own crm contacts" on crm_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Kanban Project Board (replaces Trello)
-- ---------------------------------------------------------------------------
create table kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board text not null default 'Default',
  title text not null,
  description text not null default '',
  column_name text not null default 'todo' check (column_name in ('todo', 'doing', 'done')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table kanban_cards enable row level security;
create policy "owner manages own kanban cards" on kanban_cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Wiki / Docs (replaces Slite, Nuclino) -- public read when published
-- ---------------------------------------------------------------------------
create table wiki_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Untitled',
  body text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table wiki_pages enable row level security;
create policy "public can view published wiki pages" on wiki_pages for select using (published = true);
create policy "owner manages own wiki pages" on wiki_pages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Changelog (replaces Beamer) -- public release-notes page
-- ---------------------------------------------------------------------------
create table changelogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Changelog',
  created_at timestamptz not null default now()
);
alter table changelogs enable row level security;
create policy "public can view changelogs" on changelogs for select using (true);
create policy "owner manages own changelogs" on changelogs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table changelog_entries (
  id uuid primary key default gen_random_uuid(),
  changelog_id uuid not null references changelogs(id) on delete cascade,
  version text not null default '',
  title text not null,
  body text not null default '',
  released_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table changelog_entries enable row level security;
create policy "public can view changelog entries" on changelog_entries for select using (true);
create policy "owner manages own changelog entries" on changelog_entries for all
  using (exists (select 1 from changelogs c where c.id = changelog_id and c.user_id = auth.uid()))
  with check (exists (select 1 from changelogs c where c.id = changelog_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Polls (replaces StrawPoll / quick surveys)
-- ---------------------------------------------------------------------------
create table polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  question text not null,
  options text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table polls enable row level security;
create policy "public can view polls" on polls for select using (true);
create policy "owner manages own polls" on polls for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_index int not null,
  created_at timestamptz not null default now()
);
alter table poll_votes enable row level security;
create policy "public can vote" on poll_votes for insert with check (true);
create policy "public can view poll votes" on poll_votes for select using (true);
create policy "owner deletes own poll votes" on poll_votes for delete
  using (exists (select 1 from polls p where p.id = poll_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Digital Business Card (replaces Popl / vCard tools) -- public
-- ---------------------------------------------------------------------------
create table business_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  full_name text not null default '',
  job_title text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);
alter table business_cards enable row level security;
create policy "public can view business cards" on business_cards for select using (true);
create policy "owner manages own business cards" on business_cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Timezone Meeting Planner (replaces World Time Buddy)
-- ---------------------------------------------------------------------------
create table timezone_rosters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person text not null,
  timezone text not null,
  created_at timestamptz not null default now()
);
alter table timezone_rosters enable row level security;
create policy "owner manages own timezone roster" on timezone_rosters for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Saved palettes for the Color Palette tool (replaces Coolors)
-- ---------------------------------------------------------------------------
create table color_palettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled palette',
  colors text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table color_palettes enable row level security;
create policy "owner manages own palettes" on color_palettes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Image Compressor (replaces TinyPNG/Squoosh) and Screenshot Beautifier
-- (replaces Shots.so) are fully client-side canvas tools -- no tables needed.
