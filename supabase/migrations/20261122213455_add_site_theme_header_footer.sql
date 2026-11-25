alter table public.design_system_themes
  add column header_footer_style text not null default 'boxed',
  add constraint design_system_themes_header_footer_style
    check (header_footer_style in ('boxed', 'lines'));

alter table public.design_system_settings
  add constraint published_design_theme_header_footer_style check (
    published_theme is null
    or not (published_theme ? 'header_footer_style')
    or (published_theme ->> 'header_footer_style' in ('boxed', 'lines')) is true
  );

notify pgrst, 'reload schema';
