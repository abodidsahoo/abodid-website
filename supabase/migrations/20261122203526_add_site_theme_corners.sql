-- Original inherits the existing palette and stores only its component shape.
alter table public.design_system_themes
  alter column background drop not null,
  alter column foreground drop not null,
  add column corners jsonb not null default '{"style":"rounded","radii":{}}',
  add constraint design_system_themes_palette check (
    case when id = '00000000-0000-4000-8000-000000000001' then
      name = 'Original' and background is null and foreground is null
    else
      background is not null and foreground is not null
    end
  ),
  add constraint design_system_themes_corners check (
    coalesce(
      jsonb_typeof(corners) = 'object'
      and corners ->> 'style' in ('sharp', 'rounded')
      and jsonb_typeof(corners -> 'radii') = 'object',
      false
    )
  );

alter table public.design_system_settings
  drop constraint valid_published_design_theme,
  add constraint valid_published_design_theme check (
    published_theme is null or coalesce(
      jsonb_typeof(published_theme) = 'object'
      and (published_theme ->> 'id') ~ '^[0-9a-f-]{36}$'
      and char_length(btrim(published_theme ->> 'name')) between 1 and 80
      and case when published_theme ->> 'id' = '00000000-0000-4000-8000-000000000001' then
        published_theme ->> 'name' = 'Original'
        and published_theme ->> 'background' is null
        and published_theme ->> 'foreground' is null
      else
        (published_theme ->> 'background') ~* '^#[0-9a-f]{6}$'
        and (published_theme ->> 'foreground') ~* '^#[0-9a-f]{6}$'
      end
      and (
        not (published_theme ? 'corners')
        or (
          jsonb_typeof(published_theme -> 'corners') = 'object'
          and published_theme #>> '{corners,style}' in ('sharp', 'rounded')
          and jsonb_typeof(published_theme #> '{corners,radii}') = 'object'
        )
      ),
      false
    )
  );

insert into public.design_system_themes (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Original');

-- The initial crimson preset is ready to preview with sharp corners.
update public.design_system_themes
set corners = '{"style":"sharp","radii":{}}'
where name = 'Crimson & Cream'
  and lower(background) = '#a6192e'
  and lower(foreground) = '#fff8e8';

notify pgrst, 'reload schema';
