-- Four more high-vote, low-complexity replacements from the canivibecodeit
-- death list, replacing the dropped Social Queue tool.

-- ---------------------------------------------------------------------------
-- RSS Reader (replaces Feedbin / Feedly / Inoreader / NewsBlur -- all YES)
-- Feeds are fetched and parsed server-side on demand; nothing is cached in
-- Postgres except the subscription list and read state.
-- ---------------------------------------------------------------------------
create table rss_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null default '',
  created_at timestamptz not null default now()
);
alter table rss_feeds enable row level security;
create policy "owner manages own rss feeds" on rss_feeds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table rss_read_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_url text not null,
  read_at timestamptz not null default now(),
  unique (user_id, item_url)
);
alter table rss_read_items enable row level security;
create policy "owner manages own rss read state" on rss_read_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Writing Checker (replaces Hemingway Editor / LanguageTool -- both YES)
-- Analysis is pure client-side text heuristics; only saved drafts persist.
-- ---------------------------------------------------------------------------
create table writing_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table writing_drafts enable row level security;
create policy "owner manages own writing drafts" on writing_drafts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Blog / Publishing (replaces Ghost Pro -- YES) -- public post pages
-- ---------------------------------------------------------------------------
create table blogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'My blog',
  tagline text not null default '',
  created_at timestamptz not null default now()
);
alter table blogs enable row level security;
create policy "public can view blogs" on blogs for select using (true);
create policy "owner manages own blogs" on blogs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references blogs(id) on delete cascade,
  slug text not null,
  title text not null default 'Untitled',
  body text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (blog_id, slug)
);
alter table blog_posts enable row level security;
create policy "public can view published posts" on blog_posts for select using (published = true);
create policy "owner manages own posts" on blog_posts for all
  using (exists (select 1 from blogs b where b.id = blog_id and b.user_id = auth.uid()))
  with check (exists (select 1 from blogs b where b.id = blog_id and b.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Recipe Box (replaces Paprika Recipe Manager / AnyList -- both YES)
-- ---------------------------------------------------------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ingredients text[] not null default '{}',
  steps text not null default '',
  servings int not null default 2,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table recipes enable row level security;
create policy "owner manages own recipes" on recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table grocery_items enable row level security;
create policy "owner manages own grocery list" on grocery_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Drop the Social Queue tool: its platform APIs (X paid tier, LinkedIn and
-- Instagram partner review) can't be integrated, so shipping it would mean
-- selling a tool that never actually posts. Removed rather than faked.
-- ---------------------------------------------------------------------------
drop table if exists social_posts;
