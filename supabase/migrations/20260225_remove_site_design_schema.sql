-- Remove legacy design-control schema (feature retired in favor of code-first styling)

drop trigger if exists trg_site_design_settings_updated_at on public.site_design_settings;
drop trigger if exists trg_site_design_presets_updated_at on public.site_design_presets;

drop function if exists public.set_site_design_settings_updated_at();
drop function if exists public.set_site_design_presets_updated_at();

drop table if exists public.site_design_settings;
drop table if exists public.site_design_presets;
