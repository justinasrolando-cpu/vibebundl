-- Comped/internal accounts must never appear in public traction numbers.
-- The previous TLD heuristic only caught .test/.invalid/.example, which broke
-- the moment an internal account used a normal-looking domain. An explicit
-- flag is the honest mechanism: someone has to deliberately mark an account
-- internal, and nothing about the email address can accidentally do it.
alter table subscriptions
  add column if not exists is_internal boolean not null default false;

comment on column subscriptions.is_internal is
  'Comped/staff/QA account. Excluded from public_stats() so landing-page traction figures only ever count real paying customers.';

create or replace function public_stats()
returns table (
  active_subscribers bigint,
  subscription_months numeric,
  tool_requests_count bigint,
  tools_shipped_from_requests bigint
)
language sql security definer set search_path = public as $$
  with real_subs as (
    select s.*
    from subscriptions s
    join auth.users u on u.id = s.user_id
    where s.status in ('active', 'trialing')
      and s.is_internal = false
      and u.email !~* '\.(test|invalid|example)$'
  )
  select
    (select count(*) from real_subs),
    coalesce((
      select sum(greatest(1, floor(extract(epoch from (now() - r.updated_at)) / 2592000)))
      from real_subs r
    ), 0),
    (select count(*) from tool_requests),
    (select count(*) from tool_requests where status = 'shipped');
$$;

grant execute on function public_stats() to anon, authenticated;

update subscriptions set is_internal = true
where user_id in (
  select id from auth.users
  where email in ('founder@vibebundl.dev', 'qa-tester@wevibecodedit.test')
);
