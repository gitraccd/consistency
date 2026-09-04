-- Adds real %E1RM testable progressions for Squat (new), Weighted Pull-up,
-- and Weighted Dip -- matching the existing Bench/Deadlift house style
-- (top-single + backoff set_groups, week1_percentage + cumulative weekly
-- lb increments) instead of staying freeform/RPE-autoregulated or absent
-- entirely. Numbers are sourced/researched, not guessed:
--   - Squat reuses Deadlift's exact top-single/backoff numbers (80% week1
--     top single -> [15,15,15,25], 72% week1 backoff -> [5,5,5,5]) as a
--     starting template -- the Russian Squat Program (a real documented
--     squat peaking block) validates an 80%-start, ~95-100%-peak ramp shape
--     for squat specifically, and Deadlift's numbers were just re-validated
--     (97.5% peak cap raised 2026-09-02). Not fit to Connor's real squat
--     E1RM yet -- tune via the Manage Program editor once real test data
--     exists.
--   - Weighted Pull-up/Dip E1RM is computed off ADDED WEIGHT ONLY, not
--     total load (bodyweight + added weight). Total load is the textbook-
--     correct approach for a true %1RM, but this app deliberately tracks
--     no bodyweight anywhere, and Connor is currently cutting -- a
--     total-load % would drift week to week for reasons unrelated to his
--     actual pulling/pressing strength. For one person tracking their own
--     progressive overload (not cross-lifter comparison), added-weight-only
--     Epley is sound and matches how real weighted-calisthenics progression
--     sources express jumps in practice.

-- ============ Squat: new tested exercise + its own dedicated day ============
-- No fixed weekday yet -- assign one via Manage Program once Connor picks
-- which day he'll actually squat.
insert into exercises (name, requires_test) values ('Squat', true);
insert into calibrations (exercise_id) select id from exercises where name = 'Squat';

insert into days (name, sort_order, day_of_week)
  values ('Squat', (select max(sort_order) + 1 from days), null);

insert into day_exercises (day_id, exercise_id, sort_order) values
  ((select id from days where name = 'Squat'), (select id from exercises where name = 'Squat'), 1);

insert into set_groups (day_exercise_id, reps, num_sets, is_freeform, intensity_note, week1_percentage, increments, sort_order) values
  ((select id from day_exercises where day_id = (select id from days where name = 'Squat') and exercise_id = (select id from exercises where name = 'Squat')),
    1, 1, false, null, 0.80, '[15,15,15,25]'::jsonb, 1),
  ((select id from day_exercises where day_id = (select id from days where name = 'Squat') and exercise_id = (select id from exercises where name = 'Squat')),
    3, 3, false, null, 0.72, '[5,5,5,5]'::jsonb, 2);

-- ============ Weighted Pull-up: Heavy day's top single + backoff become tested %E1RM ============
-- Updated in place (same set_group ids) so any logged_sets/weekly_targets
-- already tied to these rows are untouched. Volume day's separate 6x3
-- Weighted Pull-up set_group is deliberately left alone -- no researched
-- %E1RM number exists for it, and it's a reasonable hybrid: Heavy day now
-- tests/progresses the lift, Volume day stays flexible RPE-autoregulated
-- extra volume.
update exercises set requires_test = true where name = 'Weighted Pull-up';
insert into calibrations (exercise_id) select id from exercises where name = 'Weighted Pull-up';

update set_groups set
  is_freeform = false,
  week1_percentage = 0.80,
  increments = '[2,2,3,3]'::jsonb,
  weekly_plan = null
where day_exercise_id = (
    select id from day_exercises
    where day_id = (select id from days where name = 'Heavy')
      and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
  )
  and reps = 1 and num_sets = 1;

update set_groups set
  is_freeform = false,
  week1_percentage = 0.70,
  increments = '[1,1,2,2]'::jsonb,
  weekly_plan = null
where day_exercise_id = (
    select id from day_exercises
    where day_id = (select id from days where name = 'Heavy')
      and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
  )
  and reps = 3 and num_sets = 2;

-- ============ Weighted Dip: existing set_group becomes the backoff, add a new top single ============
-- Same in-place-update-preserves-history approach: the existing 5x3
-- freeform row becomes the 3x3 backoff (its id, and any logged_sets tied
-- to it, are unchanged). The top single is a new row since none existed.
update exercises set requires_test = true where name = 'Weighted Dip';
insert into calibrations (exercise_id) select id from exercises where name = 'Weighted Dip';

update set_groups set
  reps = 3,
  is_freeform = false,
  week1_percentage = 0.72,
  increments = '[2,2,3,3]'::jsonb
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Volume')
    and exercise_id = (select id from exercises where name = 'Weighted Dip')
);

insert into set_groups (day_exercise_id, reps, num_sets, is_freeform, intensity_note, week1_percentage, increments, sort_order) values
  ((select id from day_exercises where day_id = (select id from days where name = 'Volume') and exercise_id = (select id from exercises where name = 'Weighted Dip')),
    1, 1, false, null, 0.80, '[3,3,4,5]'::jsonb, 0);
