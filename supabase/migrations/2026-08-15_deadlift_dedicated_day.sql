-- Gives Deadlift its own dedicated day (Friday) instead of sharing Heavy
-- day with Bench. New weekday schedule: Mon=Heavy, Thu=Volume, Fri=Deadlift,
-- Sat=Technique (see lib/schedule.ts, updated in the same commit).
-- Weighted Pull-up is NOT moved -- it stays on Heavy/Volume/Technique (the
-- Bench days), unchanged.
--
-- The existing day_exercises row for (Heavy, Deadlift) is reassigned to the
-- new day rather than deleted+recreated, so its id -- and any set_groups/
-- logged_sets/weekly_targets referencing it -- stay intact.
--
-- Additive/reassignment only -- does not touch Bench, Weighted Pull-up, or
-- any other existing day/exercise data.
-- Run this once in the Supabase SQL Editor.

-- Bump Technique out of the way before inserting Deadlift at sort_order 3,
-- so the days list displays in real weekly order (Heavy, Volume, Deadlift,
-- Technique).
update days set sort_order = 4 where name = 'Technique';

insert into days (name, sort_order) values ('Deadlift', 3);

-- Reassign the existing Deadlift day_exercise from Heavy to the new day
-- (same id, so history is preserved), and reset its sort_order since it's
-- now the only exercise on this day.
update day_exercises
set day_id = (select id from days where name = 'Deadlift'),
    sort_order = 1
where day_id = (select id from days where name = 'Heavy')
  and exercise_id = (select id from exercises where name = 'Deadlift');
