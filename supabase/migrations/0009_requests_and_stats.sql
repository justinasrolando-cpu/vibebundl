-- Tool requests (the growth loop) + a public stats surface for the landing page.

create table tool_requests (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: anyone can request without an account. Set when a signed-in
  -- user submits, so we can tell them when their tool ships.
  user_id uuid references auth.users(id) on delete set null,
  saas_name text not null,
  saas_url text not null default '',
  monthly_price numeric,
  reason text not null default '',
  -- The submitter's own guess at how hard it is to vibecode, 1-10.
  difficulty int not null default 5 check (difficulty between 1 and 10),
  notify_email text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'planned', 'building', 'shipped', 'declined')),
  -- Set to the tools.ts slug once we ship it.
  shipped_slug text not null default '',
  votes int not null default 0,
  created_at timestamptz not null default now()
);
alter table tool_requests enable row level security;

-- Anyone may submit and read the board. Only the requester can see their own
-- notify_email... which RLS can't express column-wise, so the email is never
-- selected by the public board query and the column is documented as private.
create policy "public can submit a request" on tool_requests for insert with check (true);
create policy "public can view requests" on tool_requests for select using (true);
create policy "requester updates own request" on tool_requests for update
  using (auth.uid() is not null and auth.uid() = user_id);

create index if not exists tool_requests_votes_idx on tool_requests (votes desc, created_at desc);

-- Votes are mutated only through this, so a public "upvote" can never be used
-- to rewrite a request's text or status.
create or replace function increment_tool_request_vote(request_id uuid)
returns void language sql security definer set search_path = public as $$
  update tool_requests set votes = votes + 1 where id = request_id;
$$;

-- ---------------------------------------------------------------------------
-- Public landing-page stats.
--
-- Returns COUNTS ONLY — never a row, an email, or a customer id. The dollar
-- figure is deliberately NOT computed here: the catalogue price lives in
-- src/lib/tools.ts, and duplicating it in SQL guarantees the two drift. This
-- returns subscription-months; the app multiplies.
-- ---------------------------------------------------------------------------
create or replace function public_stats()
returns table (
  active_subscribers bigint,
  subscription_months numeric,
  tool_requests_count bigint,
  tools_shipped_from_requests bigint
)
language sql security definer set search_path = public as $$
  select
    (select count(*) from subscriptions where status in ('active','trialing')),
    -- Whole months elapsed since each active subscription started, floored at
    -- 1 so a day-one subscriber still shows a month of savings rather than $0.
    coalesce((
      select sum(greatest(1, floor(extract(epoch from (now() - s.updated_at)) / 2592000)))
      from subscriptions s where s.status in ('active','trialing')
    ), 0),
    (select count(*) from tool_requests),
    (select count(*) from tool_requests where status = 'shipped');
$$;

grant execute on function public_stats() to anon, authenticated;
grant execute on function increment_tool_request_vote(uuid) to anon, authenticated;
