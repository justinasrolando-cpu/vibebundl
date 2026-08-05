-- Integrity fixes surfaced by the 53-tool audit.

-- 1. One-per-user tables. Every one of these powers a single-editor UI with no
--    list view, so a second row silently bricks the tool (the page loads row A
--    while writes land on row B). The UI now defends with limit(1); this makes
--    it true at the database instead.
create unique index if not exists links_profiles_user_id_key on links_profiles (user_id);
create unique index if not exists blogs_user_id_key on blogs (user_id);
create unique index if not exists changelogs_user_id_key on changelogs (user_id);
create unique index if not exists sites_user_id_key on sites (user_id);
create unique index if not exists booking_pages_user_id_key on booking_pages (user_id);
create unique index if not exists business_cards_user_id_key on business_cards (user_id);
create unique index if not exists testimonial_spaces_user_id_key on testimonial_spaces (user_id);
create unique index if not exists feedback_boards_user_id_key on feedback_boards (user_id);
create unique index if not exists status_pages_user_id_key on status_pages (user_id);
create unique index if not exists chat_bots_user_id_key on chat_bots (user_id);

-- 2. Missing DELETE policies. Without these the delete runs, affects 0 rows,
--    and reports success — the worst kind of failure.

-- A booker cancelling, or an owner clearing a slot, was impossible.
create policy "owner deletes own bookings" on bookings for delete
  using (exists (
    select 1 from booking_slots s join booking_pages p on p.id = s.page_id
    where s.id = slot_id and p.user_id = auth.uid()
  ));

-- Someone asking to be removed from a waitlist could not be honoured without
-- deleting the entire waitlist. That is a privacy obligation, not a nicety.
create policy "owner deletes own waitlist signups" on waitlist_signups for delete
  using (exists (select 1 from waitlists w where w.id = waitlist_id and w.user_id = auth.uid()));

-- Same for collected form responses and poll votes.
create policy "owner deletes own form responses" on form_responses for delete
  using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
