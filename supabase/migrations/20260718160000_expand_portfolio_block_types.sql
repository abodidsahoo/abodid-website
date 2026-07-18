begin;

alter table public.portfolio_project_blocks
  drop constraint if exists portfolio_project_blocks_block_type_check;

alter table public.portfolio_project_blocks
  add constraint portfolio_project_blocks_block_type_check
  check (block_type in (
    'body_text',
    'heading',
    'two_columns',
    'quotation',
    'highlight',
    'testimonial',
    'outcome',
    'collaborator',
    'organisation',
    'single_image',
    'image_grid',
    'image_gallery',
    'video_embed',
    'media_text',
    'link',
    'external_link',
    'divider',
    'spacer'
  ));

commit;
