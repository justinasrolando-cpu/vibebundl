-- ===========================================================================
-- 0012 — security hardening found by the pre-launch audit
--
-- Three separate holes, all of them the same shape: a policy that was
-- written for the happy path and never re-read as an attacker would.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. business_cards was bulk-scrapable
--
-- `for select using (true)` is the right instinct for a public page keyed by
-- slug, and it's wrong for a table of contact PII: RLS is row-level, so
-- "anyone may read the row at this slug" is indistinguishable from "anyone
-- may read every row". One anon-key request against /rest/v1/business_cards
-- returned every customer's name, email, phone, company and auth UUID.
--
-- The fix is to stop serving this table over PostgREST at all and expose a
-- security-definer function that takes the slug and returns only the display
-- columns. You can still fetch a card you were given the link to; you can no
-- longer enumerate the table, and user_id never leaves the database.
-- ---------------------------------------------------------------------------
drop policy if exists "public can view business cards" on business_cards;

create or replace function public_business_card(card_slug text)
returns table (
  id uuid,
  slug text,
  full_name text,
  job_title text,
  company text,
  email text,
  phone text,
  website text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.full_name, c.job_title, c.company, c.email, c.phone, c.website
  from business_cards c
  where c.slug = card_slug
  limit 1;
$$;

revoke all on function public_business_card(text) from public;
grant execute on function public_business_card(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. uptime_checks had RLS on and no INSERT policy
--
-- The scheduled sweep runs through the service-role client, which bypasses
-- RLS — so the cron worked and the user-facing "Check now" button had been
-- 500ing for every user since 0001. A owner-scoped INSERT policy, matched to
-- the existing SELECT policy.
-- ---------------------------------------------------------------------------
drop policy if exists "owner records own uptime checks" on uptime_checks;
create policy "owner records own uptime checks" on uptime_checks for insert
  with check (
    exists (
      select 1 from uptime_monitors m
      where m.id = monitor_id and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. tool_requests could be self-promoted to "shipped"
--
-- 0009 gave the requester UPDATE on their own row with no column restriction,
-- which let any signed-in user set status='shipped' and votes=99999 on their
-- own submission. Those two columns feed the public board's sort order and
-- the "tools shipped from requests" figure on the landing page.
--
-- There is no edit UI — the board only inserts and calls the vote RPC — so
-- the policy bought nothing and cost the integrity of a public number.
-- Moderation happens through the service-role client, which is unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists "requester updates own request" on tool_requests;
