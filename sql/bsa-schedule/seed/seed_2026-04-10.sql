-- Seed template for 2026-04-10

begin;

insert into public.conference_days (day, label)
values ('2026-04-10', 'Fri 10 Apr')
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

delete from public.events where day = '2026-04-10';

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
    '2026-04-10',
    '2026-04-10 08:30:00 Europe/London'::timestamptz,
    '2026-04-10 09:30:00 Europe/London'::timestamptz,
    'Paper Session 8',
    'session',
    'DIV',
    2,
    (select id from public.rooms where name = 'Roscoe Building LT A'),
    'Paper Session 8\nVisual Knowledge in Platform Archives\nMs Emma Roe',
    'Paper Session 8 / Visual Knowledge in Platform Archives',
    20
  ),
  (
    '2026-04-10',
    '2026-04-10 15:00:00 Europe/London'::timestamptz,
    '2026-04-10 16:30:00 Europe/London'::timestamptz,
    'Reception',
    'special',
    null,
    null,
    (select id from public.rooms where name = 'Alan Turing Room'),
    'Closing Reception',
    'Closing Reception',
    90
  );

commit;
