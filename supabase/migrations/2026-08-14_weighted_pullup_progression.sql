-- Adds the Weighted Pull-up RPE-autoregulated progression (Heavy day
-- top-single + back-off, Volume day volume work, Pause day light
-- bodyweight pulling) without touching existing data. Unlike schema.sql
-- (which drops and recreates everything -- fine for a fresh setup, but NOT
-- safe to re-run against a live database with real programs/logged_sets),
-- this migration only adds a column and updates/inserts the specific rows
-- that changed, so existing set_group ids -- and any logged_sets or
-- weekly_targets referencing them -- are preserved.
--
-- Run this once in the Supabase SQL Editor. Do NOT re-run schema.sql
-- against a database that already has real data in it.

alter table set_groups add column if not exists weekly_plan jsonb;

-- Heavy day Weighted Pull-up: the existing single row becomes the top
-- single (same id, so any prior logged_sets against it stay attached).
update set_groups
set reps = 1,
    num_sets = 1,
    intensity_note = null,
    weekly_plan = '[{"week":1,"sets":1,"reps":1,"target_rpe":"7.5-8","note":"Top single"},{"week":2,"sets":1,"reps":1,"target_rpe":"~8","note":"Top single"},{"week":3,"sets":1,"reps":1,"target_rpe":"8-8.5","note":"Top single"},{"week":4,"sets":1,"reps":1,"target_rpe":"8.5-9","note":"Top single"},{"week":5,"sets":1,"reps":1,"target_rpe":"9-9.5","note":"Test: heavy single"}]'::jsonb
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Heavy')
    and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
);

-- Heavy day Weighted Pull-up: new back-off row (genuinely new, no history to preserve).
insert into set_groups (day_exercise_id, reps, num_sets, is_freeform, intensity_note, week1_percentage, increments, weekly_plan, sort_order)
values (
  (select id from day_exercises where day_id = (select id from days where name = 'Heavy') and exercise_id = (select id from exercises where name = 'Weighted Pull-up')),
  3, 2, true, null, null, null,
  '[{"week":1,"sets":2,"reps":3,"target_rpe":null,"note":"~85-88% of top single"},{"week":2,"sets":3,"reps":2,"target_rpe":null,"note":"~85-88% of top single"},{"week":3,"sets":2,"reps":2,"target_rpe":null,"note":"~87-90% of top single"},{"week":4,"sets":1,"reps":2,"target_rpe":null,"note":"~90% of top single"},{"week":5,"sets":0,"reps":0,"target_rpe":null,"note":"Skip - test day"}]'::jsonb,
  2
);

-- Volume day Weighted Pull-up: update in place (same id, preserves history).
update set_groups
set reps = 6,
    num_sets = 3,
    weekly_plan = '[{"week":1,"sets":3,"reps":6,"target_rpe":"RIR 2-3","note":null},{"week":2,"sets":4,"reps":6,"target_rpe":"RIR 2","note":null},{"week":3,"sets":4,"reps":5,"target_rpe":"RIR 1-2","note":null},{"week":4,"sets":3,"reps":5,"target_rpe":"RIR 1-2","note":null},{"week":5,"sets":2,"reps":5,"target_rpe":"RIR 3","note":"Deload"}]'::jsonb
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Volume')
    and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
);

-- Pause day Weighted Pull-up: reframe as light bodyweight pulling, flat all block (no weekly_plan).
update set_groups
set reps = 5,
    num_sets = 3,
    intensity_note = 'Light bodyweight pulling -- keep pulling fatigue low'
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Pause')
    and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
);
