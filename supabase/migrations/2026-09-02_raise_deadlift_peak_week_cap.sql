-- Raises Deadlift's peak-week (week 5) cap from ~92.5% to ~97.5% of the
-- tested E1RM. A 1RM estimated from a 1-rep RPE9 single already runs ~6.7%
-- above the actual weight lifted (Epley's RIR extrapolation), so the old
-- 92.5% cap let week 5 land *below* the weight already pulled on test day
-- -- the opposite of progressive overload. 97.5% mirrors Bench's own
-- margin and reliably peaks past the tested single instead. Only affects
-- future program creation (weekly_targets already computed for existing
-- programs are untouched).
update set_groups
set increments = '[15,15,15,25]'::jsonb
where id in (
  select sg.id
  from set_groups sg
  join day_exercises de on de.id = sg.day_exercise_id
  join days d on d.id = de.day_id
  join exercises e on e.id = de.exercise_id
  where d.name = 'Deadlift' and e.name = 'Deadlift' and sg.reps = 1 and sg.num_sets = 1
);
