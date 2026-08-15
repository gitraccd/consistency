-- Renames the "Pause" day to "Technique" and swaps Paused Bench from 5
-- sets of 4 reps to 4 sets of 5 reps (same 20-rep total volume,
-- redistributed). The day's day_exercises.sort_order values already put
-- Paused Bench -> Weighted Pull-up -> Incline DB -> Chest-Supported Row in
-- the right order -- that was never the problem, fetchTemplate() in api.ts
-- was ignoring sort_order and sorting exercises alphabetically instead
-- (fixed in the same commit as this migration). Renaming the day is safe:
-- day_exercises/set_groups reference days.id, not name, so nothing else
-- needs updating except lib/schedule.ts's weekday mapping (also fixed in
-- code).
--
-- Additive/renaming only -- does not touch any other day or exercise.
-- Run this once in the Supabase SQL Editor.

update days set name = 'Technique' where name = 'Pause';

update set_groups
set reps = 5,
    num_sets = 4
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Technique')
    and exercise_id = (select id from exercises where name = 'Paused Bench')
);
