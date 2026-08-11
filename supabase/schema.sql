-- Consistency app schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Tables are deliberately separate (lifts / programs / test_lifts /
-- weekly_targets / logged_sets / calibrations) rather than one flat
-- structure: a program is a 5-week block, a test_lift is the one-time
-- input that seeds it, weekly_targets are the generated plan, logged_sets
-- are what actually happened, and calibrations persist per-lift across
-- programs (a correction factor isn't tied to any single block).

create extension if not exists pgcrypto;

-- Reference table of trainable lifts. Not hardcoded to 3 lifts at the
-- schema level -- expanding back to Squat/OHP later is just a new row.
create table lifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Week 1 target = default_week1_percentage * E1RM. Null until a real
  -- test locks it in (Deadlift/Weighted Pull-up start null per PRD).
  default_week1_percentage numeric,
  -- Weeks 2-5 cumulative additive increments over the week 1 weight,
  -- e.g. [10,10,5,5] means week2 = week1+10, week3 = week1+20, etc.
  default_increments jsonb not null default '[0,0,0,0]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- One 5-week training block with a start date.
create table programs (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  created_at timestamptz not null default now()
);

-- The one-time test that seeds a lift's targets for a given program.
create table test_lifts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  lift_id uuid not null references lifts(id),
  mode text not null check (mode in ('raw_epley', 'rpe_based', 'manual_e1rm', 'manual_week1_weight')),
  -- raw_epley / rpe_based inputs
  input_weight numeric,
  input_reps int,
  input_rpe numeric,
  -- manual_e1rm input
  manual_e1rm numeric,
  -- manual_week1_weight input (no E1RM involved at all)
  manual_week1_weight numeric,
  -- percentage used to turn an E1RM into a week 1 weight (not used in manual_week1_weight mode)
  week1_percentage numeric,
  -- E1RM the app computed (Epley/RPE modes) or was told directly (manual_e1rm); null in manual_week1_weight mode
  computed_e1rm numeric,
  created_at timestamptz not null default now(),
  unique (program_id, lift_id)
);

-- The generated week-by-week plan, one row per lift per week.
create table weekly_targets (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  lift_id uuid not null references lifts(id),
  week_number int not null check (week_number between 1 and 5),
  target_weight numeric not null,
  created_at timestamptz not null default now(),
  unique (program_id, lift_id, week_number)
);

-- Actual sets performed, logged against a program/lift/week.
create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  lift_id uuid not null references lifts(id),
  week_number int not null check (week_number between 1 and 5),
  weight numeric not null,
  reps int not null,
  rpe numeric,
  is_max_effort boolean not null default false,
  logged_at timestamptz not null default now()
);

-- Per-lift correction factor, persists across programs (P1: EMA-updated
-- from max-effort set outcomes, gated by a minimum data-point guardrail).
create table calibrations (
  id uuid primary key default gen_random_uuid(),
  lift_id uuid not null unique references lifts(id),
  correction_factor numeric not null default 1.0,
  data_point_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed the v1 lift scope (Bench confirmed from real data; Deadlift and
-- Weighted Pull-up use Bench's increments as a placeholder and have no
-- locked week1 percentage yet -- see PRD Open Questions).
insert into lifts (name, default_week1_percentage, default_increments, sort_order) values
  ('Bench', 0.75, '[10,10,5,5]'::jsonb, 1),
  ('Weighted Pull-up', null, '[10,10,5,5]'::jsonb, 2),
  ('Deadlift', null, '[10,10,5,5]'::jsonb, 3);

insert into calibrations (lift_id, correction_factor, data_point_count)
  select id, 1.0, 0 from lifts;

-- RLS: enabled on every table. This app has no login (PRD: single-user,
-- "accounts for anyone but me" is an explicit non-goal), so policies are
-- permissive for any request carrying the publishable key -- the same
-- key that ends up in the deployed PWA's JS bundle. That means anyone
-- who finds the deployed URL and inspects it could read/write this data
-- (workout logs, bodyweight). Acceptable for a personal v1; revisit with
-- Supabase Auth if that stops being acceptable.
alter table lifts enable row level security;
alter table programs enable row level security;
alter table test_lifts enable row level security;
alter table weekly_targets enable row level security;
alter table logged_sets enable row level security;
alter table calibrations enable row level security;

create policy "public read lifts" on lifts for select using (true);
create policy "public write lifts" on lifts for all using (true) with check (true);
create policy "public all programs" on programs for all using (true) with check (true);
create policy "public all test_lifts" on test_lifts for all using (true) with check (true);
create policy "public all weekly_targets" on weekly_targets for all using (true) with check (true);
create policy "public all logged_sets" on logged_sets for all using (true) with check (true);
create policy "public all calibrations" on calibrations for all using (true) with check (true);
