-- Consistency app schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Models the real program structure: a block runs 3 training days per week
-- (Heavy / Volume / Pause), each day has several exercises, and a single
-- exercise can have multiple independent set/rep/weight schemes within one
-- day (e.g. Heavy Bench = a top single AND a separate back-off scheme).
-- Days/exercises/set_groups are a fixed template (seeded once, not
-- per-program) that every block reuses; only exercise_tests/weekly_targets/
-- logged_sets are per-program. One E1RM test per real exercise (just Bench
-- today) drives every set-group derived from it, including "Paused Bench"
-- which borrows Bench's E1RM via e1rm_source_exercise_id at a lower
-- percentage. Freeform set-groups (accessories, "Moderate Intensity" work)
-- have no percentage/increments at all -- just a rep/set target, logged
-- freely. Blocks are 6 weeks: weeks 1-5 are programmed, week 6 is an
-- unprogrammed deload (no weekly_targets row, but logged_sets still allows
-- it since real sets get logged that week).
--
-- Single-user app (no auth) -- see RLS note at the bottom.

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

create extension if not exists pgcrypto;

-- One 5-programmed-week + 1-deload-week block with a start date.
create table programs (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  created_at timestamptz not null default now()
);

-- Real trainable movements. e1rm_source_exercise_id lets a variant (e.g.
-- "Paused Bench") borrow another exercise's tested E1RM instead of needing
-- its own test. requires_test=true means this exercise gets its own
-- exercise_tests entry each program (just Bench today).
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  requires_test boolean not null default false,
  e1rm_source_exercise_id uuid references exercises(id),
  created_at timestamptz not null default now()
);

-- Heavy / Volume / Pause -- the fixed weekly training-day split.
create table days (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

-- Which exercises appear on which day, and in what order. The same
-- exercise (e.g. Bench) can appear under multiple days as separate rows.
create table day_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  sort_order int not null default 0
);

-- The atomic loggable unit: one rep/set scheme within a day_exercise.
-- Repeated identical spreadsheet rows (e.g. 4 rows of "3 @ 180/190/...")
-- collapse into one row with num_sets=4. week1_percentage/increments are
-- only set when is_freeform=false.
create table set_groups (
  id uuid primary key default gen_random_uuid(),
  day_exercise_id uuid not null references day_exercises(id) on delete cascade,
  reps int not null,
  num_sets int not null,
  is_freeform boolean not null default false,
  intensity_note text,
  week1_percentage numeric,
  increments jsonb,
  sort_order int not null default 0
);

-- The one-time test that seeds E1RM-derived set-groups for a program.
-- Only for exercises with requires_test=true.
create table exercise_tests (
  id uuid primary key default gen_random_uuid(),
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
-- meaningful for requires_test=true exercises (just Bench today).
create table calibrations (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null unique references exercises(id),
  correction_factor numeric not null default 1.0,
  data_point_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed: exercises. Bench is the only tested exercise; Paused Bench derives
-- its E1RM from Bench at a lower percentage. Everything else is freeform.
insert into exercises (name, requires_test) values ('Bench', true);
insert into exercises (name, requires_test, e1rm_source_exercise_id)
  values ('Paused Bench', false, (select id from exercises where name = 'Bench'));
insert into exercises (name) values
  ('Weighted Pull-up'),
  ('Incline DB'),
  ('Chest-Supported Row'),
  ('Weighted Dip');

insert into calibrations (exercise_id)
  select id from exercises where requires_test = true;

-- Seed: days
insert into days (name, sort_order) values
  ('Heavy', 1),
  ('Volume', 2),
  ('Pause', 3);

-- Seed: day_exercises
insert into day_exercises (day_id, exercise_id, sort_order) values
  ((select id from days where name = 'Heavy'), (select id from exercises where name = 'Bench'), 1),
  ((select id from days where name = 'Heavy'), (select id from exercises where name = 'Weighted Pull-up'), 2),
  ((select id from days where name = 'Heavy'), (select id from exercises where name = 'Incline DB'), 3),
  ((select id from days where name = 'Heavy'), (select id from exercises where name = 'Chest-Supported Row'), 4),
  ((select id from days where name = 'Volume'), (select id from exercises where name = 'Bench'), 1),
  ((select id from days where name = 'Volume'), (select id from exercises where name = 'Weighted Pull-up'), 2),
  ((select id from days where name = 'Volume'), (select id from exercises where name = 'Weighted Dip'), 3),
  ((select id from days where name = 'Volume'), (select id from exercises where name = 'Chest-Supported Row'), 4),
  ((select id from days where name = 'Pause'), (select id from exercises where name = 'Paused Bench'), 1),
  ((select id from days where name = 'Pause'), (select id from exercises where name = 'Weighted Pull-up'), 2),
  ((select id from days where name = 'Pause'), (select id from exercises where name = 'Incline DB'), 3),
  ((select id from days where name = 'Pause'), (select id from exercises where name = 'Chest-Supported Row'), 4);

-- Seed: set_groups. Percentages back-calculated against a 240lb E1RM
-- (225x1 @ RPE9, the real test this spreadsheet was built from):
--   Heavy top single  195/240 = 0.8125
--   Heavy back-off     180/240 = 0.75
--   Volume top set     185/240 = 0.770833
--   Pause top set      175/240 = 0.729167
-- Increments are the cumulative additive weekly jumps observed in the
-- spreadsheet (week2 = week1 + increments[0], week3 = week1 + [0]+[1], ...).
insert into set_groups (day_exercise_id, reps, num_sets, is_freeform, intensity_note, week1_percentage, increments, sort_order) values
  -- Heavy
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Bench')),
    1, 1, false, null, 0.8125, '[5,10,10,15]'::jsonb, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Bench')),
    3, 4, false, null, 0.75, '[10,10,5,10]'::jsonb, 2),
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Weighted Pull-up')),
    5, 4, true, 'Moderate Intensity', null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Incline DB')),
    8, 2, true, null, null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Chest-Supported Row')),
    8, 2, true, null, null, null, 1),
  -- Volume
  ((select id from day_exercises where day_id = (select id from days where name = 'Volume') and exercise_id = (select id from exercises where name = 'Bench')),
    5, 5, false, null, 0.770833, '[5,5,5,5]'::jsonb, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Volume') and exercise_id = (select id from exercises where name = 'Weighted Pull-up')),
    6, 4, true, 'Moderate Intensity', null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Volume') and exercise_id = (select id from exercises where name = 'Weighted Dip')),
    5, 3, true, null, null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Volume') and exercise_id = (select id from exercises where name = 'Chest-Supported Row')),
    8, 2, true, null, null, null, 1),
  -- Pause
  ((select id from day_exercises where day_id = (select id from days where name = 'Pause') and exercise_id = (select id from exercises where name = 'Paused Bench')),
    4, 5, false, null, 0.729167, '[5,5,5,5]'::jsonb, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Pause') and exercise_id = (select id from exercises where name = 'Weighted Pull-up')),
    5, 5, true, 'Moderate Intensity', null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Pause') and exercise_id = (select id from exercises where name = 'Incline DB')),
    8, 2, true, null, null, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Pause') and exercise_id = (select id from exercises where name = 'Chest-Supported Row')),
    8, 2, true, null, null, null, 1);

-- RLS: enabled on every table. This app has no login (personal, single-user
-- tool), so policies are permissive for any request carrying the
-- publishable key -- the same key that ends up in the deployed PWA's JS
-- bundle. That means anyone who finds the deployed URL and inspects it
-- could read/write this data (workout logs, bodyweight). Acceptable for a
-- personal v1; revisit with Supabase Auth if that stops being acceptable.
alter table programs enable row level security;
alter table exercises enable row level security;
alter table days enable row level security;
alter table day_exercises enable row level security;
alter table set_groups enable row level security;
alter table exercise_tests enable row level security;
alter table weekly_targets enable row level security;
alter table logged_sets enable row level security;
alter table calibrations enable row level security;

create policy "public all programs" on programs for all using (true) with check (true);
create policy "public all exercises" on exercises for all using (true) with check (true);
create policy "public all days" on days for all using (true) with check (true);
create policy "public all day_exercises" on day_exercises for all using (true) with check (true);
create policy "public all set_groups" on set_groups for all using (true) with check (true);
create policy "public all exercise_tests" on exercise_tests for all using (true) with check (true);
create policy "public all weekly_targets" on weekly_targets for all using (true) with check (true);
create policy "public all logged_sets" on logged_sets for all using (true) with check (true);
create policy "public all calibrations" on calibrations for all using (true) with check (true);
