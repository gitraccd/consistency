-- Adds a data-driven weekday assignment to days, replacing the app's
-- hardcoded WEEKDAY_SCHEDULE constant (src/lib/schedule.ts). 0=Sun..6=Sat
-- (JS Date#getDay() convention); null = no fixed weekday.
alter table days add column day_of_week int;

-- Backfill the 4 existing seeded days to match today's hardcoded schedule
-- (Heavy->Mon, Volume->Thu, Deadlift->Fri, Technique->Sat) so behavior is
-- unchanged for the current live data.
update days set day_of_week = 1 where name = 'Heavy';
update days set day_of_week = 4 where name = 'Volume';
update days set day_of_week = 5 where name = 'Deadlift';
update days set day_of_week = 6 where name = 'Technique';
