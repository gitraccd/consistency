-- Converts Weighted Pull-up's Volume-day set from RPE-autoregulated freeform
-- to a flat linear added-weight progression, per 2026-09-05/06 research:
-- no elite/logged source validates a %E1RM scheme for this specific lift
-- (this app's added-weight-only convention has no clean %-of-total-load
-- analog), and the one real logged attempt at percentage-based programming
-- for weighted pull-ups (a Tactical Barbell forum lifter) found it "way too
-- light" and switched to flat linear increments instead.
--
-- week1_offset is a new alternative to week1_percentage: week1 weight =
-- tested E1RM + week1_offset (offset typically negative), so it still
-- anchors to your actual test result each block rather than a hardcoded
-- absolute number. increments continue to work as flat additive lbs per
-- week, same mechanism Heavy day already uses.
alter table set_groups add column week1_offset numeric;

update set_groups sg
set is_freeform = false,
    week1_offset = -20,
    increments = '[2,2,3,3]'::jsonb,
    weekly_plan = null
from day_exercises de, days d, exercises e
where sg.day_exercise_id = de.id
  and de.day_id = d.id
  and de.exercise_id = e.id
  and d.name = 'Volume'
  and e.name = 'Weighted Pull-up'
  and sg.is_freeform = true;
