alter table public.page_metadata
  add column if not exists focus_keyword text,
  add column if not exists og_image_alt text,
  add column if not exists robots_index boolean not null default true;

comment on column public.page_metadata.focus_keyword is
  'Internal primary search phrase used by the SEO Studio; it is not emitted as a meta keywords tag.';

comment on column public.page_metadata.og_image_alt is
  'Accessible description for the page social sharing image.';

comment on column public.page_metadata.robots_index is
  'Whether published metadata allows the page to be indexed by search engines.';
