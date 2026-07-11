begin;

insert into public.portfolio_taxonomy_terms(group_type, label, slug, sort_order) values
  ('primary','Creative','creative',10),
  ('primary','Technology','technology',20),
  ('primary','Research','research',30),
  ('primary','Experimental','experimental',40),
  ('primary','Film','film',50),
  ('primary','Photography','photography',60),
  ('role','Creative Producer','creative-producer',10),
  ('role','Director','director',20),
  ('role','Editor','editor',30),
  ('role','Cinematographer','cinematographer',40),
  ('role','Exhibition Designer','exhibition-designer',50),
  ('role','Photographer','photographer',60),
  ('role','Researcher','researcher',70),
  ('role','Creative Technologist','creative-technologist',80),
  ('role','Artist','artist',90),
  ('role','Writer','writer',100),
  ('role','Strategist','strategist',110),
  ('role','Creative Director','creative-director',120),
  ('role','Client Servicing / Developer','client-servicing-developer',130),
  ('role','Social Media Manager','social-media-manager',140),
  ('role','Workshop Facilitation','workshop-facilitation',150),
  ('role','Concept Development','concept-development',160)
on conflict (group_type, slug) do update set label = excluded.label, sort_order = excluded.sort_order;

commit;
