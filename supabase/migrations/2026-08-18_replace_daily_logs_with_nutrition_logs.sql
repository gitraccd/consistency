-- Replaces daily_logs (bodyweight/calories/steps, added in
-- 2026-08-15_add_daily_logs.sql) with nutrition_logs (calories/protein
-- only). Scope changed before this ever shipped a UI: bodyweight is
-- tracked separately, elsewhere, and the Calories card became its own
-- dedicated screen instead of a quick-entry popover.
--
-- Safe to drop -- daily_logs has been empty since it was created, nothing
-- was ever logged against it. Run this once in the Supabase SQL Editor.

drop table if exists daily_logs cascade;

create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  calories numeric,
  protein numeric,
  created_at timestamptz not null default now()
);

alter table nutrition_logs enable row level security;
create policy "public all nutrition_logs" on nutrition_logs for all using (true) with check (true);
