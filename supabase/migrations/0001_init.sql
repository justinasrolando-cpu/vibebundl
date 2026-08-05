-- Can I Vibecode It? bundle -- shared schema for all 20 tools.
-- Ownership model:
--   "owner" tables:  auth.uid() = user_id, no public access.
--   "container" tables (profile/waitlist/form/etc): owner has full CRUD,
--     public gets a narrow SELECT (and sometimes INSERT) for the public-facing page.
--   "child" tables (items inside a container): access is derived from the
--     parent container's user_id via EXISTS subqueries.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- subscriptions (gates /dashboard access)
-- ---------------------------------------------------------------------------
create table subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create policy "owner can read own subscription" on subscriptions
  for select using (auth.uid() = user_id);
-- writes only happen via the Stripe webhook using the service role key.

-- ---------------------------------------------------------------------------
-- 1. Link in Bio
-- ---------------------------------------------------------------------------
create table links_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table links_profiles enable row level security;
create policy "public can view profiles" on links_profiles for select using (true);
create policy "owner manages own profiles" on links_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table links_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references links_profiles(id) on delete cascade,
  title text not null,
  url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table links_items enable row level security;
create policy "public can view link items" on links_items for select using (true);
create policy "owner manages own link items" on links_items for all
  using (exists (select 1 from links_profiles p where p.id = profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from links_profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. URL Shortener (redirect resolution happens server-side with the
--    service role key, so there is deliberately no public select policy here)
-- ---------------------------------------------------------------------------
create table short_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  target_url text not null,
  created_at timestamptz not null default now()
);
alter table short_links enable row level security;
create policy "owner manages own short links" on short_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table short_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references short_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text
);
alter table short_link_clicks enable row level security;
create policy "owner reads own link clicks" on short_link_clicks for select
  using (exists (select 1 from short_links l where l.id = link_id and l.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Waitlist Pages
-- ---------------------------------------------------------------------------
create table waitlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
alter table waitlists enable row level security;
create policy "public can view waitlists" on waitlists for select using (true);
create policy "owner manages own waitlists" on waitlists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  waitlist_id uuid not null references waitlists(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (waitlist_id, email)
);
alter table waitlist_signups enable row level security;
create policy "public can join waitlist" on waitlist_signups for insert with check (true);
create policy "owner reads own waitlist signups" on waitlist_signups for select
  using (exists (select 1 from waitlists w where w.id = waitlist_id and w.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. QR Codes
-- ---------------------------------------------------------------------------
create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);
alter table qr_codes enable row level security;
create policy "owner manages own qr codes" on qr_codes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Newsletter
-- ---------------------------------------------------------------------------
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  subscribed_at timestamptz not null default now(),
  unique (user_id, email)
);
alter table newsletter_subscribers enable row level security;
create policy "public can subscribe" on newsletter_subscribers for insert with check (true);
create policy "owner reads own subscribers" on newsletter_subscribers for select
  using (auth.uid() = user_id);
create policy "owner updates own subscribers" on newsletter_subscribers for update
  using (auth.uid() = user_id);
create policy "owner deletes own subscribers" on newsletter_subscribers for delete
  using (auth.uid() = user_id);

create table newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table newsletter_campaigns enable row level security;
create policy "owner manages own campaigns" on newsletter_campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Notes
-- ---------------------------------------------------------------------------
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table notes enable row level security;
create policy "owner manages own notes" on notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. Bookmarks
-- ---------------------------------------------------------------------------
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table bookmarks enable row level security;
create policy "owner manages own bookmarks" on bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. Read Later
-- ---------------------------------------------------------------------------
create table readlater_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null default '',
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now()
);
alter table readlater_items enable row level security;
create policy "owner manages own read-later items" on readlater_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. Tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project text not null default 'Inbox',
  title text not null,
  notes text not null default '',
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table tasks enable row level security;
create policy "owner manages own tasks" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10. Time Tracker
-- ---------------------------------------------------------------------------
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project text not null default '',
  task text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table time_entries enable row level security;
create policy "owner manages own time entries" on time_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 11. Forms
-- ---------------------------------------------------------------------------
create table forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Untitled form',
  fields jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table forms enable row level security;
create policy "public can view forms" on forms for select using (true);
create policy "owner manages own forms" on forms for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table form_responses enable row level security;
create policy "public can submit form response" on form_responses for insert with check (true);
create policy "owner reads own form responses" on form_responses for select
  using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 12. Testimonials
-- ---------------------------------------------------------------------------
create table testimonial_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default '',
  created_at timestamptz not null default now()
);
alter table testimonial_spaces enable row level security;
create policy "public can view testimonial spaces" on testimonial_spaces for select using (true);
create policy "owner manages own testimonial spaces" on testimonial_spaces for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references testimonial_spaces(id) on delete cascade,
  author_name text not null default 'Anonymous',
  author_email text,
  content text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table testimonials enable row level security;
create policy "public can submit testimonial" on testimonials for insert with check (true);
create policy "public can view approved testimonials" on testimonials for select using (approved = true);
create policy "owner reads own testimonials" on testimonials for select
  using (exists (select 1 from testimonial_spaces s where s.id = space_id and s.user_id = auth.uid()));
create policy "owner moderates own testimonials" on testimonials for update
  using (exists (select 1 from testimonial_spaces s where s.id = space_id and s.user_id = auth.uid()));
create policy "owner deletes own testimonials" on testimonials for delete
  using (exists (select 1 from testimonial_spaces s where s.id = space_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 13. Feedback / Feature-vote Board
-- ---------------------------------------------------------------------------
create table feedback_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default '',
  created_at timestamptz not null default now()
);
alter table feedback_boards enable row level security;
create policy "public can view feedback boards" on feedback_boards for select using (true);
create policy "owner manages own feedback boards" on feedback_boards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table feedback_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references feedback_boards(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'done')),
  votes int not null default 0,
  created_at timestamptz not null default now()
);
alter table feedback_posts enable row level security;
create policy "public can view feedback posts" on feedback_posts for select using (true);
create policy "public can submit feedback post" on feedback_posts for insert with check (true);
create policy "owner moderates own feedback posts" on feedback_posts for update
  using (exists (select 1 from feedback_boards b where b.id = board_id and b.user_id = auth.uid()));
create policy "owner deletes own feedback posts" on feedback_posts for delete
  using (exists (select 1 from feedback_boards b where b.id = board_id and b.user_id = auth.uid()));

-- votes are only mutated through this security-definer RPC so that the
-- public "upvote" action can't be used to edit a post's title/description.
create or replace function increment_feedback_vote(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update feedback_posts set votes = votes + 1 where id = post_id;
$$;

-- ---------------------------------------------------------------------------
-- 14. Uptime Monitor
-- ---------------------------------------------------------------------------
create table uptime_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  label text not null default '',
  interval_minutes int not null default 5,
  last_checked_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);
alter table uptime_monitors enable row level security;
create policy "owner manages own monitors" on uptime_monitors for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table uptime_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references uptime_monitors(id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null,
  status_code int,
  response_ms int
);
alter table uptime_checks enable row level security;
create policy "owner reads own uptime checks" on uptime_checks for select
  using (exists (select 1 from uptime_monitors m where m.id = monitor_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 15. Site Builder
-- ---------------------------------------------------------------------------
create table sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Untitled site',
  blocks jsonb not null default '[]',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table sites enable row level security;
create policy "public can view published sites" on sites for select using (published = true);
create policy "owner manages own sites" on sites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 16. Resume Builder
-- ---------------------------------------------------------------------------
create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My Resume',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table resumes enable row level security;
create policy "owner manages own resumes" on resumes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 17. Job Application Tracker
-- ---------------------------------------------------------------------------
create table job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null default '',
  status text not null default 'applied' check (status in ('applied', 'interview', 'offer', 'rejected')),
  notes text not null default '',
  applied_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table job_applications enable row level security;
create policy "owner manages own job applications" on job_applications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 18. Diagrams (Mermaid)
-- ---------------------------------------------------------------------------
create table diagrams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled diagram',
  source text not null default 'graph TD\n  A --> B',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table diagrams enable row level security;
create policy "owner manages own diagrams" on diagrams for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 19. AI Writer
-- ---------------------------------------------------------------------------
create table ai_writer_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null,
  prompt text not null,
  output text not null default '',
  created_at timestamptz not null default now()
);
alter table ai_writer_drafts enable row level security;
create policy "owner manages own ai writer drafts" on ai_writer_drafts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 20. PDF Tools is fully client-side (pdf-lib in the browser) -- no table needed.
