-- On Technique day, "Weighted Pull-up" -> "Pull-up" (a new, distinct
-- bodyweight-only exercise -- not a rename of the shared Heavy/Volume
-- exercise, since those really are weighted). Also clears the guidance
-- text and the set/rep prescription entirely (reps/num_sets -> 0, which
-- the UI now treats as "nothing to show" and hides the subtitle line --
-- see ProgramTable.tsx/LiftTracker.tsx, updated in the same commit).
--
-- The existing day_exercises row is reassigned to the new exercise (not
-- deleted+recreated), so its id -- and any set_groups/logged_sets
-- referencing it -- stay intact. Heavy/Volume's Weighted Pull-up rows are
-- untouched.
--
-- Additive/reassignment only. Run this once in the Supabase SQL Editor.

insert into exercises (name) values ('Pull-up');

update day_exercises
set exercise_id = (select id from exercises where name = 'Pull-up')
where day_id = (select id from days where name = 'Technique')
  and exercise_id = (select id from exercises where name = 'Weighted Pull-up');

update set_groups
set reps = 0,
    num_sets = 0,
    intensity_note = null
where day_exercise_id = (
  select id from day_exercises
  where day_id = (select id from days where name = 'Technique')
    and exercise_id = (select id from exercises where name = 'Pull-up')
);
