-- Seed template for 2026-04-09

begin;

insert into public.conference_days (day, label)
values ('2026-04-09', 'Thu 9 Apr')
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

delete from public.events where day = '2026-04-09';

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
    '2026-04-09',
    '2026-04-09 08:00:00 Europe/London'::timestamptz,
    '2026-04-09 09:00:00 Europe/London'::timestamptz,
    'Coffee',
    'break',
    null,
    null,
    (select id from public.rooms where name = 'Roscoe Building LT A'),
    'Refreshments',
    'Refreshments',
    10
  ),
  (
    '2026-04-09',
    '2026-04-09 09:00:00 Europe/London'::timestamptz,
    '2026-04-09 10:00:00 Europe/London'::timestamptz,
    'Keynote',
    'special',
    null,
    null,
    (select id from public.rooms where name = 'Alan Turing Room'),
    'Keynote Address\nProf John Smith',
    'Keynote Address',
    20
  );

commit;
