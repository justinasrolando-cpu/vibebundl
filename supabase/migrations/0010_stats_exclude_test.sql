-- Two corrections found after the request/sponsor build.

-- 1. public_stats() was counting the QA account as a paying customer, so the
--    landing page reported real money saved by a subscriber that does not
--    exist. Exclude reserved-TLD addresses (.test / .invalid / .example are
--    non-routable by RFC 2606, so no real customer can ever have one).
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

-- 2. tool_requests is a public write surface with no DELETE policy, so spam
--    would be permanent and publicly visible. Service-role moderation still
--    bypasses RLS, but a requester should be able to withdraw their own post.
create policy "requester deletes own request" on tool_requests for delete
  using (auth.uid() is not null and auth.uid() = user_id);
