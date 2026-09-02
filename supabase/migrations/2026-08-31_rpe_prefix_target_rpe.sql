-- Cosmetic fix: the UI used to hardcode an "RPE " prefix when rendering
-- weekly_plan.target_rpe, which produced "RPE RIR 3" for the Volume-day
-- Weighted Pull-up entries (their target_rpe strings are already
-- self-labeled as "RIR ..."). The UI no longer adds a prefix -- it just
-- prints target_rpe as-is -- so the plain-number entries (Heavy day top
-- single) need "RPE " baked into the string themselves. Run this once in
-- the Supabase SQL Editor.

update set_groups
set weekly_plan = '[{"week":1,"sets":1,"reps":1,"target_rpe":"RPE 7.5-8","note":"Top single"},{"week":2,"sets":1,"reps":1,"target_rpe":"RPE ~8","note":"Top single"},{"week":3,"sets":1,"reps":1,"target_rpe":"RPE 8-8.5","note":"Top single"},{"week":4,"sets":1,"reps":1,"target_rpe":"RPE 8.5-9","note":"Top single"},{"week":5,"sets":1,"reps":1,"target_rpe":"RPE 9-9.5","note":"Test: heavy single"}]'::jsonb
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Heavy')
    and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
)
and sort_order = 1;
