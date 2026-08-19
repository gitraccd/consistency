-- Changes nutrition_logs from "one upserted row per day" to append-only
-- (same shape as logged_sets): drops the log_date uniqueness so multiple
-- meals/snacks per day can accumulate into that day's total instead of
-- overwriting each other. Adds an optional label (e.g. "Breakfast") and
-- renames created_at -> logged_at for consistency with logged_sets.
--
-- Preserves any existing rows (including the earlier test entry, if you
-- haven't deleted it yet) -- this only alters the table shape.
-- Run this once in the Supabase SQL Editor.

alter table nutrition_logs drop constraint if exists nutrition_logs_log_date_key;
alter table nutrition_logs add column if not exists label text;
alter table nutrition_logs rename column created_at to logged_at;
