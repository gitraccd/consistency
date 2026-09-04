-- Adds Supabase Auth-based multi-tenancy: every table gets a user_id
-- (defaulting to auth.uid(), so no app code needs to pass it explicitly on
-- insert), and RLS is rewritten from "anyone with the key" to "only your
-- own rows". user_id is left NULLABLE here -- existing rows (all of
-- Connor's real data) have none yet. DO NOT use the app or click "set up
-- starter program" until you've also run the backfill migration
-- (2026-09-03_backfill_your_data.sql.template) with your own user id, or
-- your real data will be invisible and a fresh generic template will get
-- created alongside it, colliding once you do backfill.
--
-- Sequence:
--   1. Run this migration.
--   2. Sign up for a real account through the app's new sign-up screen.
--   3. Find your user id: `select id, email from auth.users;`
--   4. Copy supabase/migrations/2026-09-03_backfill_your_data.sql.template,
--      fill in your user id, and run THAT before opening the app again.

alter table programs add column user_id uuid references auth.users(id) default auth.uid();
alter table exercises add column user_id uuid references auth.users(id) default auth.uid();
alter table days add column user_id uuid references auth.users(id) default auth.uid();
alter table day_exercises add column user_id uuid references auth.users(id) default auth.uid();
alter table set_groups add column user_id uuid references auth.users(id) default auth.uid();
alter table exercise_tests add column user_id uuid references auth.users(id) default auth.uid();
alter table weekly_targets add column user_id uuid references auth.users(id) default auth.uid();
alter table logged_sets add column user_id uuid references auth.users(id) default auth.uid();
alter table calibrations add column user_id uuid references auth.users(id) default auth.uid();
alter table nutrition_logs add column user_id uuid references auth.users(id) default auth.uid();

-- exercises.name was globally unique (single-user assumption) -- now two
-- different accounts can both have a "Bench".
alter table exercises drop constraint if exists exercises_name_key;

-- nutrition_goals moves from "one fixed-id row for the whole app"
-- (NUTRITION_GOAL_ID in api.ts) to "one row per user, unique on user_id".
alter table nutrition_goals add column user_id uuid references auth.users(id) default auth.uid();
alter table nutrition_goals add constraint nutrition_goals_user_id_key unique (user_id);
alter table nutrition_goals alter column id set default gen_random_uuid();

-- Drop the old wide-open policies, replace with one "own rows" policy per
-- table -- same shape everywhere, no special cases.
drop policy if exists "public all programs" on programs;
drop policy if exists "public all exercises" on exercises;
drop policy if exists "public all days" on days;
drop policy if exists "public all day_exercises" on day_exercises;
drop policy if exists "public all set_groups" on set_groups;
drop policy if exists "public all exercise_tests" on exercise_tests;
drop policy if exists "public all weekly_targets" on weekly_targets;
drop policy if exists "public all logged_sets" on logged_sets;
drop policy if exists "public all calibrations" on calibrations;
drop policy if exists "public all nutrition_logs" on nutrition_logs;
drop policy if exists "public all nutrition_goals" on nutrition_goals;

create policy "own rows" on programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on day_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on set_groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on exercise_tests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on weekly_targets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on logged_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on calibrations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on nutrition_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on nutrition_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
