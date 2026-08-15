-- Fixes the Volume day Weighted Pull-up progression from the previous
-- migration (2026-08-14_weighted_pullup_progression.sql), which had already
-- run against the live database. That version ramped RIR down to 1-2 by
-- weeks 3-4, copying the Heavy day's intensification pattern onto a day
-- that was only ever supposed to hold steady at "roughly 1-3 RIR" per
-- Connor's own spec -- near-failure sets cost disproportionate recovery,
-- and stacking that alongside Day 1's top single during a cut undermines
-- the whole point of having a lower-fatigue volume day. Corrected version
-- progresses through sets (3->4->5->4) instead of intensity, keeping RIR
-- pinned at 2-3 except one top set in week 4. Also clears the stale
-- "Moderate Intensity" intensity_note, now redundant with the RIR text.
--
-- Run this once in the Supabase SQL Editor, after the first pull-up migration.

update set_groups
set intensity_note = null,
    weekly_plan = '[{"week":1,"sets":3,"reps":6,"target_rpe":"RIR 3","note":null},{"week":2,"sets":4,"reps":6,"target_rpe":"RIR 2-3","note":null},{"week":3,"sets":5,"reps":6,"target_rpe":"RIR 2-3","note":null},{"week":4,"sets":4,"reps":6,"target_rpe":"RIR 2","note":"Last set to RIR 1"},{"week":5,"sets":2,"reps":5,"target_rpe":"RIR 3","note":"Deload"}]'::jsonb
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Volume')
    and exercise_id = (select id from exercises where name = 'Weighted Pull-up')
);
