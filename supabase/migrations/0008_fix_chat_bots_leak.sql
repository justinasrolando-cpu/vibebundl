-- SECURITY FIX: chat_bots leaked every owner's knowledge_base publicly.
--
-- The original policy was:
--   create policy "public can view chat bots" on chat_bots for select using (true);
-- It existed so the public widget page (/c/[slug]) could read the bot's name.
-- But RLS is row-level, not column-level, so "using (true)" also handed out
-- knowledge_base -- owner-authored support content that routinely contains
-- internal pricing, policies and contact details -- to any anonymous caller
-- doing `select * from chat_bots`. Verified exploitable with the anon key.
--
-- Column GRANTs can't fix this alone: the owner's dashboard legitimately needs
-- to read knowledge_base to edit it, and a single table can't say "owner sees
-- all columns, everyone else sees two".
--
-- So: no public row access at all. The two server routes that must read a bot
-- (/c/[slug] page and /api/chat/[slug]) use the service-role client, which
-- bypasses RLS, and each returns only what the browser is allowed to see.
-- Owners keep full access to their own rows via the owner policy.

drop policy if exists "public can view chat bots" on chat_bots;

-- Belt and braces: even if a permissive policy is reintroduced later, the
-- anon role cannot read the sensitive columns through PostgREST.
revoke select (knowledge_base) on chat_bots from anon;
