-- 5 more tools to comfortably clear the "35+ tools" bundle claim.

-- ---------------------------------------------------------------------------
-- Expense Tracker (replaces Expensify)
-- ---------------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null default 0,
  category text not null default 'general',
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;
create policy "owner manages own expenses" on expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Booking Page (replaces Calendly / Cal.com / SavvyCal) -- owner-defined
-- slots, no external calendar sync.
-- ---------------------------------------------------------------------------
create table booking_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Book a time',
  duration_minutes int not null default 30,
  created_at timestamptz not null default now()
);
alter table booking_pages enable row level security;
create policy "public can view booking pages" on booking_pages for select using (true);
create policy "owner manages own booking pages" on booking_pages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table booking_slots (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references booking_pages(id) on delete cascade,
  start_time timestamptz not null,
  created_at timestamptz not null default now()
);
alter table booking_slots enable row level security;
create policy "public can view booking slots" on booking_slots for select using (true);
create policy "owner manages own booking slots" on booking_slots for all
  using (exists (select 1 from booking_pages p where p.id = page_id and p.user_id = auth.uid()))
  with check (exists (select 1 from booking_pages p where p.id = page_id and p.user_id = auth.uid()));

create table bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references booking_slots(id) on delete cascade,
  name text not null,
  email text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table bookings enable row level security;
-- No public select policy here (name/email are PII) -- "which slots are
-- taken" is served publicly via /api/booking/[slug]/route.ts using the
-- admin client, returning only slot ids, never booker details.
create policy "public can book an open slot" on bookings for insert with check (true);
create policy "owner reads own bookings" on bookings for select
  using (exists (
    select 1 from booking_slots s join booking_pages p on p.id = s.page_id
    where s.id = slot_id and p.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Workout Log (replaces Hevy Pro)
-- ---------------------------------------------------------------------------
create table workout_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  sets int not null default 1,
  reps int not null default 1,
  weight numeric not null default 0,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table workout_entries enable row level security;
create policy "owner manages own workout entries" on workout_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Sticky Note Board (replaces Whimsical / Excalidraw+ -- a lightweight
-- freeform sticky-note canvas, not full vector drawing)
-- ---------------------------------------------------------------------------
create table whiteboard_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled board',
  notes jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table whiteboard_boards enable row level security;
create policy "owner manages own whiteboard boards" on whiteboard_boards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Status Page (replaces Better Stack / UptimeRobot's public status page)
-- Reuses the existing uptime_monitors/uptime_checks tables from 0001.
-- ---------------------------------------------------------------------------
create table status_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Status',
  monitor_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table status_pages enable row level security;
create policy "public can view status pages" on status_pages for select using (true);
create policy "owner manages own status pages" on status_pages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- The public status page itself reads monitor status via
-- /api/status/[slug]/route.ts using the admin client, which cross-checks
-- that each monitor_id actually belongs to the status page's user_id before
-- returning anything -- uptime_monitors keeps its existing owner-only RLS
-- policy unchanged (no new public policy needed on that table).
