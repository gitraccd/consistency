-- Consistency app schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Models the real program structure: a block runs several training days per
-- week (Heavy / Volume / Deadlift / Squat / Technique), each day has
-- several exercises, and a single exercise can have multiple independent
-- set/rep/weight schemes within one day (e.g. Heavy Bench = a top single
-- AND a separate back-off scheme).
-- Days/exercises/set_groups are a fixed template (seeded once per user, not
-- per-program) that every block reuses; only exercise_tests/weekly_targets/
-- logged_sets are per-program. One E1RM test per real exercise drives every
-- set-group derived from it, including a variant like "Paused Bench" which
-- borrows Bench's E1RM via e1rm_source_exercise_id at a lower percentage.
-- Freeform set-groups (accessories, "Moderate Intensity" work) have no
-- percentage/increments at all -- just a rep/set target, logged freely.
-- Blocks are 6 weeks: weeks 1-5 are programmed, week 6 is an unprogrammed
-- deload (no weekly_targets row, but logged_sets still allows it since real
-- sets get logged that week).
--
-- Multi-tenant via Supabase Auth: every table has a user_id defaulting to
-- auth.uid(), and RLS restricts every row to its owner (see the bottom of
-- this file). A fresh install seeds NO exercises/days/set_groups -- that
-- data is per-user now, not global -- see bootstrapStarterTemplate() in
-- src/lib/api.ts, which is the one place the actual starter numbers
-- (Squat/Bench/Deadlift/Weighted Pull-up/Weighted Dip and their
-- percentages) live, run once for a brand-new account via an in-app button.

drop table if exists logged_sets cascade;
drop table if exists weekly_targets cascade;
drop table if exists calibrations cascade;
drop table if exists exercise_tests cascade;
drop table if exists set_groups cascade;
drop table if exists day_exercises cascade;
drop table if exists days cascade;
drop table if exists exercises cascade;
drop table if exists test_lifts cascade;
drop table if exists lifts cascade;
drop table if exists programs cascade;
drop table if exists nutrition_logs cascade;
drop table if exists nutrition_goals cascade;

create extension if not exists pgcrypto;

-- One 5-programmed-week + 1-deload-week block with a start date.
create table programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  start_date date not null,
  created_at timestamptz not null default now()
);

-- Real trainable movements. e1rm_source_exercise_id lets a variant (e.g.
-- "Paused Bench") borrow another exercise's tested E1RM instead of needing
-- its own test. requires_test=true means this exercise gets its own
-- exercise_tests entry each program.
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  name text not null,
  requires_test boolean not null default false,
  e1rm_source_exercise_id uuid references exercises(id),
  created_at timestamptz not null default now()
);

-- Heavy / Volume / Technique -- the fixed weekly training-day split.
-- day_of_week: 0=Sun..6=Sat (JS Date#getDay() convention), null = no fixed
-- weekday -- drives scheduledDayName() in src/lib/schedule.ts.
create table days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  name text not null,
  sort_order int not null default 0,
  day_of_week int
);

-- Which exercises appear on which day, and in what order. The same
-- exercise (e.g. Bench) can appear under multiple days as separate rows.
create table day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  day_id uuid not null references days(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  sort_order int not null default 0
);

-- The atomic loggable unit: one rep/set scheme within a day_exercise.
-- Repeated identical spreadsheet rows (e.g. 4 rows of "3 @ 180/190/...")
-- collapse into one row with num_sets=4. week1_percentage/increments are
-- only set when is_freeform=false.
-- weekly_plan holds a WeeklyPlanEntry[] (see database.types.ts) for
-- RPE-autoregulated progressions that don't have a tested E1RM to derive a
-- weight target from -- an alternative to week1_percentage/increments, not
-- used together with it.
create table set_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  day_exercise_id uuid not null references day_exercises(id) on delete cascade,
  reps int not null,
  num_sets int not null,
  is_freeform boolean not null default false,
  intensity_note text,
  week1_percentage numeric,
  increments jsonb,
  weekly_plan jsonb,
  sort_order int not null default 0,
  -- Rest-timer override in seconds. Null = use the app-wide default
  -- (a Heavy top single may want longer rest than backoff/volume work).
  rest_seconds int
);

-- The one-time test that seeds E1RM-derived set-groups for a program.
-- Only for exercises with requires_test=true.
create table exercise_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  program_id uuid not null references programs(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  mode text not null check (mode in ('raw_epley', 'rpe_based', 'manual_e1rm')),
  input_weight numeric,
  input_reps int,
  input_rpe numeric,
  manual_e1rm numeric,
  computed_e1rm numeric,
  created_at timestamptz not null default now(),
  unique (program_id, exercise_id)
);

-- Generated week 1-5 targets, one row per set_group per week. No row for
-- week 6 (deload) -- it's a label in the UI, not a computed number.
create table weekly_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  program_id uuid not null references programs(id) on delete cascade,
  set_group_id uuid not null references set_groups(id) on delete cascade,
  week_number int not null check (week_number between 1 and 5),
  target_weight numeric not null,
  created_at timestamptz not null default now(),
  unique (program_id, set_group_id, week_number)
);

-- Actual sets performed. Week 6 (deload) is allowed here even though it
-- has no weekly_targets row.
create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  program_id uuid not null references programs(id) on delete cascade,
  set_group_id uuid not null references set_groups(id) on delete cascade,
  week_number int not null check (week_number between 1 and 6),
  weight numeric not null,
  reps int not null,
  rpe numeric,
  is_max_effort boolean not null default false,
  logged_at timestamptz not null default now()
);

-- Per-exercise correction factor, persists across programs. Only
-- meaningful for requires_test=true exercises.
create table calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  exercise_id uuid not null unique references exercises(id),
  correction_factor numeric not null default 1.0,
  data_point_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Calorie/protein tracking for the cut, on its own dedicated screen (not
-- folded into logged_sets/programs). Append-only, same shape as
-- logged_sets -- multiple entries per day (breakfast, lunch, dinner, ...)
-- that accumulate into that day's total, computed client-side by summing
-- entries for a given log_date. Bodyweight is tracked separately,
-- elsewhere, by design -- not in this app.
create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  log_date date not null,
  label text,
  calories numeric,
  protein numeric,
  logged_at timestamptz not null default now()
);

-- Daily calorie/protein target. One row per user (unique on user_id),
-- upserted via onConflict:'user_id' -- there's only ever one current goal
-- per user, not a history of past goals.
create table nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid() unique,
  calories numeric,
  protein numeric,
  updated_at timestamptz not null default now()
);

-- RLS: every table restricted to its own user_id via auth.uid(). A fresh
-- install seeds no exercises/days/set_groups -- a brand-new account starts
-- empty and uses the in-app "set up starter program" button
-- (bootstrapStarterTemplate() in src/lib/api.ts) to get Connor's current
-- Squat/Bench/Deadlift/Weighted Pull-up/Weighted Dip setup as an editable
-- starting point.
alter table programs enable row level security;
alter table exercises enable row level security;
alter table days enable row level security;
alter table day_exercises enable row level security;
alter table set_groups enable row level security;
alter table exercise_tests enable row level security;
alter table weekly_targets enable row level security;
alter table logged_sets enable row level security;
alter table calibrations enable row level security;
alter table nutrition_logs enable row level security;
alter table nutrition_goals enable row level security;

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
