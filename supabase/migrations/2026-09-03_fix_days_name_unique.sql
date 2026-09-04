-- Missed in 2026-09-03_multi_tenancy_schema.sql: days.name was globally
-- unique (single-user assumption), same issue as exercises.name -- now
-- every user needs their own "Heavy"/"Volume"/etc, so a second account
-- (or the starter-template bootstrap, whose day names match Connor's
-- existing ones) hits "duplicate key value violates unique constraint
-- days_name_key" trying to insert a day name that already exists for a
-- different user.
alter table days drop constraint if exists days_name_key;

-- Verification, not a fix: lists every UNIQUE constraint left on the 11
-- multi-tenant tables. Read the output after running this. Expected rows
-- (both correctly per-user, not global, so NOT bugs):
--   exercise_tests_program_id_exercise_id_key      (program_id already scopes it to one user)
--   weekly_targets_program_id_set_group_id_week_number_key  (same)
--   calibrations_exercise_id_key                   (exercise_id is a globally-unique UUID regardless of owner, no cross-user collision possible)
--   nutrition_goals_user_id_key                     (added deliberately, one goal row per user)
-- If anything ELSE shows up here (especially a single-column constraint on
-- programs/exercises/days/day_exercises/set_groups/logged_sets/nutrition_logs
-- other than the primary key), that's the same bug as days_name_key and
-- needs the same drop-constraint treatment -- send me the output.
select tc.table_name, tc.constraint_name, string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
where tc.constraint_type = 'UNIQUE'
  and tc.table_schema = 'public'
  and tc.table_name in (
    'programs', 'exercises', 'days', 'day_exercises', 'set_groups',
    'exercise_tests', 'weekly_targets', 'logged_sets', 'calibrations',
    'nutrition_logs', 'nutrition_goals'
  )
group by tc.table_name, tc.constraint_name
order by tc.table_name;
