-- Lets a set-group override the app's default rest-timer duration (e.g. a
-- longer rest after a Heavy top single than after backoff/volume work).
-- Null = use the app-wide default (REST_DURATION_SECONDS in App.tsx).
alter table set_groups add column rest_seconds int;
