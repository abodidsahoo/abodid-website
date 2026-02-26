# BSA Seed Pattern

If this is a fresh Supabase project, run:

`sql/bsa-schedule/setup_and_seed_2026-04-08_to_2026-04-10.sql`

This file creates schema + RLS + policies + seed data in one idempotent pass.

1. Keep `title_raw` exactly as pasted from the source spreadsheet.
2. Put cleaned, speaker-free UI text in `title_display`.
3. Enter source times in Manchester time using `timestamptz` literals like `'2026-04-08 09:30:00 Europe/London'::timestamptz`.
4. The UI is fixed to Manchester time (`Europe/London`, GMT/BST).
5. Upsert `conference_days`, `themes`, and `rooms` before event inserts.
6. Delete one day from `events` and reinsert that day to keep imports idempotent.
