-- Seed template for 2026-04-08
-- Enter times exactly as Manchester local clock time (Europe/London).
-- Use explicit Europe/London timestamptz literals.

begin;

insert into public.conference_days (day, label)
values ('2026-04-08', 'Wed 8 Apr')
on conflict (day) do update
set label = excluded.label;

insert into public.themes (code, name)
values
  ('FAR', 'Families and Relationships'),
  ('DIV', 'Digital and Visual Sociology'),
  ('REM', 'Reimagining Methods')
on conflict (code) do update
set name = excluded.name;

insert into public.rooms (name)
values
  ('Roscoe Building LT A'),
  ('Roscoe Building LT B'),
  ('Alan Turing Room')
on conflict (name) do nothing;

-- Optional: re-seed this day cleanly.
delete from public.events where day = '2026-04-08';

-- title_raw: exact text from source cell (can include speaker lines)
-- title_display: UI-safe title with speaker-only lines removed
-- Example speaker-line cleanup:
-- title_raw = 'Paper Session 4\nCloud Memories and Algorithmic Recall\nDr Jane Doe'
-- title_display = 'Paper Session 4 / Cloud Memories and Algorithmic Recall'

insert into public.events (
  day,
  start_at,
  end_at,
  session_block,
  kind,
  theme_code,
  track,
  room_id,
  title_raw,
  title_display,
  sort_order
)
values
  (
    '2026-04-08',
    '2026-04-08 08:00:00 Europe/London'::timestamptz,
    '2026-04-08 09:00:00 Europe/London'::timestamptz,
    'Registration',
    'special',
    null,
    null,
    (select id from public.rooms where name = 'Roscoe Building LT A'),
    'Registration and Welcome Coffee',
    'Registration and Welcome Coffee',
    10
  ),
  (
    '2026-04-08',
    '2026-04-08 09:00:00 Europe/London'::timestamptz,
    '2026-04-08 10:30:00 Europe/London'::timestamptz,
    'Paper Session 1',
    'session',
    'FAR',
    1,
    (select id from public.rooms where name = 'Roscoe Building LT B'),
    'Paper Session 1\nCloud Memories and Algorithmic Recall\nDr Jane Doe',
    'Paper Session 1 / Cloud Memories and Algorithmic Recall',
    20
  );

commit;
