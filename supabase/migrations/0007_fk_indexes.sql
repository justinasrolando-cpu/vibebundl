-- Performance: index every foreign key.
--
-- Why this matters here specifically: nearly every RLS policy in this schema
-- is either "auth.uid() = user_id" or an EXISTS subquery joining a child table
-- to its parent (e.g. form_responses -> forms). Postgres does NOT create an
-- index on the referencing side of a foreign key automatically, so without
-- these every policy check degrades into a sequential scan once tables grow.
-- Also makes "on delete cascade" cheap instead of a full scan per parent row.
--
-- Safe to re-run: all statements are IF NOT EXISTS.

create index if not exists idx_ai_writer_drafts_user_id on ai_writer_drafts (user_id);
create index if not exists idx_analytics_events_site_id on analytics_events (site_id);
create index if not exists idx_analytics_sites_user_id on analytics_sites (user_id);
create index if not exists idx_blogs_user_id on blogs (user_id);
create index if not exists idx_booking_pages_user_id on booking_pages (user_id);
create index if not exists idx_booking_slots_page_id on booking_slots (page_id);
create index if not exists idx_bookmarks_user_id on bookmarks (user_id);
create index if not exists idx_budget_envelopes_user_id on budget_envelopes (user_id);
create index if not exists idx_business_cards_user_id on business_cards (user_id);
create index if not exists idx_changelog_entries_changelog_id on changelog_entries (changelog_id);
create index if not exists idx_changelogs_user_id on changelogs (user_id);
create index if not exists idx_chat_bots_user_id on chat_bots (user_id);
create index if not exists idx_chat_messages_bot_id on chat_messages (bot_id);
create index if not exists idx_color_palettes_user_id on color_palettes (user_id);
create index if not exists idx_crm_contacts_user_id on crm_contacts (user_id);
create index if not exists idx_diagrams_user_id on diagrams (user_id);
create index if not exists idx_expenses_user_id on expenses (user_id);
create index if not exists idx_feedback_boards_user_id on feedback_boards (user_id);
create index if not exists idx_feedback_posts_board_id on feedback_posts (board_id);
create index if not exists idx_focus_sessions_user_id on focus_sessions (user_id);
create index if not exists idx_form_responses_form_id on form_responses (form_id);
create index if not exists idx_forms_user_id on forms (user_id);
create index if not exists idx_grocery_items_user_id on grocery_items (user_id);
create index if not exists idx_habits_user_id on habits (user_id);
create index if not exists idx_invoice_clients_user_id on invoice_clients (user_id);
create index if not exists idx_invoices_client_id on invoices (client_id);
create index if not exists idx_invoices_user_id on invoices (user_id);
create index if not exists idx_job_applications_user_id on job_applications (user_id);
create index if not exists idx_kanban_cards_user_id on kanban_cards (user_id);
create index if not exists idx_links_items_profile_id on links_items (profile_id);
create index if not exists idx_links_profiles_user_id on links_profiles (user_id);
create index if not exists idx_meeting_notes_user_id on meeting_notes (user_id);
create index if not exists idx_newsletter_campaigns_user_id on newsletter_campaigns (user_id);
create index if not exists idx_notes_user_id on notes (user_id);
create index if not exists idx_poll_votes_poll_id on poll_votes (poll_id);
create index if not exists idx_polls_user_id on polls (user_id);
create index if not exists idx_portfolio_holdings_user_id on portfolio_holdings (user_id);
create index if not exists idx_qr_codes_user_id on qr_codes (user_id);
create index if not exists idx_readlater_items_user_id on readlater_items (user_id);
create index if not exists idx_recipes_user_id on recipes (user_id);
create index if not exists idx_resumes_user_id on resumes (user_id);
create index if not exists idx_rss_feeds_user_id on rss_feeds (user_id);
create index if not exists idx_seo_audits_user_id on seo_audits (user_id);
create index if not exists idx_short_link_clicks_link_id on short_link_clicks (link_id);
create index if not exists idx_short_links_user_id on short_links (user_id);
create index if not exists idx_sites_user_id on sites (user_id);
create index if not exists idx_snippets_user_id on snippets (user_id);
create index if not exists idx_status_pages_user_id on status_pages (user_id);
create index if not exists idx_tasks_user_id on tasks (user_id);
create index if not exists idx_testimonial_spaces_user_id on testimonial_spaces (user_id);
create index if not exists idx_testimonials_space_id on testimonials (space_id);
create index if not exists idx_time_entries_user_id on time_entries (user_id);
create index if not exists idx_timezone_rosters_user_id on timezone_rosters (user_id);
create index if not exists idx_tts_snippets_user_id on tts_snippets (user_id);
create index if not exists idx_uptime_checks_monitor_id on uptime_checks (monitor_id);
create index if not exists idx_uptime_monitors_user_id on uptime_monitors (user_id);
create index if not exists idx_voice_notes_user_id on voice_notes (user_id);
create index if not exists idx_waitlists_user_id on waitlists (user_id);
create index if not exists idx_webhook_logs_relay_id on webhook_logs (relay_id);
create index if not exists idx_webhook_relays_user_id on webhook_relays (user_id);
create index if not exists idx_whiteboard_boards_user_id on whiteboard_boards (user_id);
create index if not exists idx_wiki_pages_user_id on wiki_pages (user_id);
create index if not exists idx_workout_entries_user_id on workout_entries (user_id);
create index if not exists idx_writing_drafts_user_id on writing_drafts (user_id);
