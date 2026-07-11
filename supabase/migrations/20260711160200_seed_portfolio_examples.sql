begin;

-- Three limited WIP examples derived only from existing Research records/routes.
insert into public.portfolio_projects(id, slug, status, visibility, featured_order, storage_folder) values
  ('10000000-0000-4000-8000-000000000001','invisible-punctum','wip','public',10,'invisible-punctum'),
  ('10000000-0000-4000-8000-000000000002','gesture-image-preview','wip','public',20,'gesture-image-preview'),
  ('10000000-0000-4000-8000-000000000003','polaroid-hub','wip','public',30,'polaroid-hub')
on conflict (id) do nothing;

insert into public.portfolio_project_revisions(
  id, project_id, state, revision_number, title, one_line_description, year_start,
  work_in_progress, limited_public, cover_url, cover_alt, search_visible, published_at
) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','draft',1,'Invisible Punctums','An AI-driven exploration of human memory, data, and the gaps in our digital archives.',2026,true,true,'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg','Invisible Punctums research project cover',true,null),
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','published',2,'Invisible Punctums','An AI-driven exploration of human memory, data, and the gaps in our digital archives.',2026,true,true,'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg','Invisible Punctums research project cover',true,now()),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','draft',1,'Gesture Image Preview','A hand-gesture-controlled card stack for previewing photographs as if they were physical cards, with a simple voice-trigger layer for sound-based interaction.',2026,true,true,'https://assets.newatlas.com/dims4/default/83c8dc7/2147483647/strip/true/crop/1564x1043+0+19/resize/800x533!/format/webp/quality/90/?url=https%3A%2F%2Fnewatlas-brightspot.s3.amazonaws.com%2Farchive%2Fgest-1.jpg','Hand gesture interface research reference image',true,null),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','published',2,'Gesture Image Preview','A hand-gesture-controlled card stack for previewing photographs as if they were physical cards, with a simple voice-trigger layer for sound-based interaction.',2026,true,true,'https://assets.newatlas.com/dims4/default/83c8dc7/2147483647/strip/true/crop/1564x1043+0+19/resize/800x533!/format/webp/quality/90/?url=https%3A%2F%2Fnewatlas-brightspot.s3.amazonaws.com%2Farchive%2Fgest-1.jpg','Hand gesture interface research reference image',true,now()),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','draft',1,'Polaroid Hub','An interactive photo arrangement experiment - handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning.',2026,true,true,'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769637180128_m89jj2boy.jpg','Polaroid Hub interactive photography project cover',true,null),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','published',2,'Polaroid Hub','An interactive photo arrangement experiment - handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning.',2026,true,true,'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769637180128_m89jj2boy.jpg','Polaroid Hub interactive photography project cover',true,now())
on conflict (id) do nothing;

update public.portfolio_projects set draft_revision_id = '20000000-0000-4000-8000-000000000001', published_revision_id = '30000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000001';
update public.portfolio_projects set draft_revision_id = '20000000-0000-4000-8000-000000000002', published_revision_id = '30000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000002';
update public.portfolio_projects set draft_revision_id = '20000000-0000-4000-8000-000000000003', published_revision_id = '30000000-0000-4000-8000-000000000003' where id = '10000000-0000-4000-8000-000000000003';

insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
select mapping.revision_id::uuid, term.id, mapping.display_order
from (values
  ('20000000-0000-4000-8000-000000000001','primary','research',0),
  ('20000000-0000-4000-8000-000000000001','primary','technology',1),
  ('20000000-0000-4000-8000-000000000001','primary','experimental',2),
  ('30000000-0000-4000-8000-000000000001','primary','research',0),
  ('30000000-0000-4000-8000-000000000001','primary','technology',1),
  ('30000000-0000-4000-8000-000000000001','primary','experimental',2),
  ('20000000-0000-4000-8000-000000000002','primary','research',0),
  ('20000000-0000-4000-8000-000000000002','primary','technology',1),
  ('20000000-0000-4000-8000-000000000002','primary','photography',2),
  ('30000000-0000-4000-8000-000000000002','primary','research',0),
  ('30000000-0000-4000-8000-000000000002','primary','technology',1),
  ('30000000-0000-4000-8000-000000000002','primary','photography',2),
  ('20000000-0000-4000-8000-000000000003','primary','creative',0),
  ('20000000-0000-4000-8000-000000000003','primary','research',1),
  ('20000000-0000-4000-8000-000000000003','primary','photography',2),
  ('30000000-0000-4000-8000-000000000003','primary','creative',0),
  ('30000000-0000-4000-8000-000000000003','primary','research',1),
  ('30000000-0000-4000-8000-000000000003','primary','photography',2)
) as mapping(revision_id, group_type, slug, display_order)
join public.portfolio_taxonomy_terms term on term.group_type = mapping.group_type and term.slug = mapping.slug
on conflict do nothing;

insert into public.portfolio_revision_links(revision_id, link_type, label, url, display_order) values
  ('20000000-0000-4000-8000-000000000001','external','Open the existing research project','/research/invisible-punctum',0),
  ('30000000-0000-4000-8000-000000000001','external','Open the existing research project','/research/invisible-punctum',0),
  ('20000000-0000-4000-8000-000000000002','external','Open the existing research project','/research/gesture-image-preview',0),
  ('30000000-0000-4000-8000-000000000002','external','Open the existing research project','/research/gesture-image-preview',0),
  ('20000000-0000-4000-8000-000000000003','external','Open the existing research project','/research/polaroid-hub',0),
  ('30000000-0000-4000-8000-000000000003','external','Open the existing research project','/research/polaroid-hub',0)
on conflict do nothing;

commit;

