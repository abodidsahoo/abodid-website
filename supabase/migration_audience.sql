-- MIGRATION: Update Audience Types
-- We need to drop the existing check constraint and add a new one with the expanded list.

alter table public.hub_resources
drop constraint if exists hub_resources_audience_check;

alter table public.hub_resources
add constraint hub_resources_audience_check 
check (audience in ('Designer', 'Artist', 'Filmmaker', 'Creative Technologist', 'Researcher', 'General Audience', 'Other'));
