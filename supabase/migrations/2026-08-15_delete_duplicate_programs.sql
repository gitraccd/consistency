-- Data cleanup, not a schema change: deletes the 4 empty duplicate
-- programs created today while troubleshooting the fetchLatestProgram
-- bug (missing created_at tiebreaker, fixed in the same commit as this
-- file). All 4 have zero logged_sets -- verified before writing this.
-- Keeps the 00:38 program (a28fbd1a-...), which has 7 real logged sets.
-- on delete cascade also removes each duplicate's exercise_tests and
-- weekly_targets rows (both empty for these 4 already).
--
-- Run this once in the Supabase SQL Editor.

delete from programs where id in (
  '2cdc4a79-84f5-4f1d-a7c7-87be700ccd1d',
  '258b6fc4-a908-4125-b2f0-2d146c320681',
  '1b2e68ce-b6ce-47eb-8085-bd6e459917de',
  '9c104ec6-9610-46b2-8ec8-50cd2ac60c59'
);
