-- Adds nutrition_goals: a single always-one-row table for the current
-- calorie/protein target, upserted at a fixed id from the app (see
-- NUTRITION_GOAL_ID in api.ts). Not a history of past goals -- just the
-- current one, editable anytime from the Nutrition screen.
--
-- Brand new table -- no existing data to preserve. Run this once in the
-- Supabase SQL Editor.

create table nutrition_goals (
  id uuid primary key,
  calories numeric,
  protein numeric,
  updated_at timestamptz not null default now()
);

alter table nutrition_goals enable row level security;
create policy "public all nutrition_goals" on nutrition_goals for all using (true) with check (true);
