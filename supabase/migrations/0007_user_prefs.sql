-- User preferences: pinned tools and account settings.

create table pinned_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_slug text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, tool_slug)
);
alter table pinned_tools enable row level security;
create policy "owner manages own pinned tools" on pinned_tools for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  accent text not null default 'green',
  updated_at timestamptz not null default now()
);
alter table user_profiles enable row level security;
create policy "owner manages own profile" on user_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
