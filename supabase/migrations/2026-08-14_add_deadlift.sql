-- Adds Deadlift as a second tested exercise (Heavy day only, top single +
-- back-off like Bench). Decided 2026-08-14: 1x/week given deadlift's much
-- higher systemic/spinal fatigue cost vs. Bench's 3x/week spread; trusted
-- test 375x1 @ RPE9 -> E1RM ~400 via the existing rpeBased1RM formula.
-- Percentages mirror Bench's build shape (moderate weekly climb, bigger
-- jump into a week-5 peak) but capped at 92.5% E1RM rather than Bench's
-- ~98%, since this is deadlift's only weekly exposure with no other
-- pulling/lower-body work to spread the peak-week fatigue across.
--
-- Additive only -- does not touch Bench or any other existing data.
-- Run this once in the Supabase SQL Editor.

insert into exercises (name, requires_test) values ('Deadlift', true);

-- Required: api.ts's calibration-update path does a .single() lookup on
-- calibrations by exercise_id, which throws if no row exists yet.
insert into calibrations (exercise_id) values ((select id from exercises where name = 'Deadlift'));

insert into day_exercises (day_id, exercise_id, sort_order) values
  ((select id from days where name = 'Heavy'), (select id from exercises where name = 'Deadlift'), 5);

insert into set_groups (day_exercise_id, reps, num_sets, is_freeform, intensity_note, week1_percentage, increments, weekly_plan, sort_order) values
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Deadlift')),
    1, 1, false, null, 0.80, '[10,10,10,20]'::jsonb, null, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Deadlift')),
    3, 3, false, null, 0.72, '[5,5,5,5]'::jsonb, null, 2);
