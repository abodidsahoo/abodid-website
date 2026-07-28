create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.network_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_record_key text not null,
  first_name text,
  last_name text,
  full_name text not null,
  linkedin_url text,

  source_email text,
  source_company text,
  source_position text,
  connected_on date,
  imported_at timestamptz not null default now(),
  last_seen_in_export timestamptz not null default now(),
  present_in_latest_export boolean not null default true,
  import_snapshot jsonb not null default '{}'::jsonb,

  email text,
  company text,
  position text,
  city text,
  region text,
  country text,
  personal_website text,

  work_categories text[] not null default '{}'::text[],
  expertise_keywords text[] not null default '{}'::text[],
  outreach_goals text[] not null default '{}'::text[],
  relationship_tier text not null default 'unrated'
    check (relationship_tier in ('unrated', 'weak', 'familiar', 'strong')),
  tags text[] not null default '{}'::text[],
  starred boolean not null default false,

  notes text,
  relationship_context text,
  public_summary text,
  match_explanation text,
  employment_history jsonb not null default '[]'::jsonb,
  public_links jsonb not null default '[]'::jsonb,
  enrichment_sources jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  incoming_conflicts jsonb not null default '{}'::jsonb,

  last_verified_at timestamptz,
  enrichment_status text not null default 'unenriched'
    check (enrichment_status in ('unenriched', 'pending', 'review', 'enriched', 'failed')),
  verification_state text not null default 'source_only'
    check (verification_state in ('source_only', 'verified', 'probable', 'ambiguous', 'stale')),
  confidence jsonb not null default '{}'::jsonb,

  has_email boolean not null default false,
  email_type text not null default 'none'
    check (email_type in ('none', 'personal', 'work', 'unknown')),
  newsletter_status text not null default 'not_subscribed'
    check (newsletter_status in ('not_subscribed', 'subscribed', 'unsubscribed', 'unknown')),
  newsletter_consent_source text,
  do_not_contact boolean not null default false,

  archived boolean not null default false,
  search_text text not null default '',
  search_document tsvector,
  embedding extensions.vector(1536),
  embedding_model text,
  embedded_at timestamptz,
  embedding_input_hash text,
  embedding_refresh_needed boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (owner_id, source_record_key)
);

comment on table public.network_contacts is
  'Private owner-scoped network database sourced from LinkedIn Connections.csv and reviewed public evidence.';
comment on column public.network_contacts.newsletter_status is
  'Explicit newsletter consent state. Never inferred from email availability.';
comment on column public.network_contacts.import_snapshot is
  'Most recently imported original CSV values, retained without silent replacement by enrichment.';

create table if not exists public.network_import_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_filename text not null,
  source_sha256 text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.network_contacts enable row level security;
alter table public.network_import_runs enable row level security;

drop policy if exists "Network contacts are owner only" on public.network_contacts;
create policy "Network contacts are owner only"
on public.network_contacts
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Network import runs are owner only" on public.network_import_runs;
create policy "Network import runs are owner only"
on public.network_import_runs
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

revoke all on table public.network_contacts from anon;
revoke all on table public.network_import_runs from anon;
grant select, insert, update, delete on table public.network_contacts to authenticated;
grant select, insert, update, delete on table public.network_import_runs to authenticated;

create index if not exists network_contacts_owner_name_idx
on public.network_contacts (owner_id, full_name);

create index if not exists network_contacts_owner_company_idx
on public.network_contacts (owner_id, company);

create index if not exists network_contacts_owner_connected_idx
on public.network_contacts (owner_id, connected_on desc);

create index if not exists network_contacts_owner_email_idx
on public.network_contacts (owner_id, has_email);

create index if not exists network_contacts_work_categories_idx
on public.network_contacts using gin (work_categories);

create index if not exists network_contacts_expertise_keywords_idx
on public.network_contacts using gin (expertise_keywords);

create index if not exists network_contacts_outreach_goals_idx
on public.network_contacts using gin (outreach_goals);

create index if not exists network_contacts_tags_idx
on public.network_contacts using gin (tags);

create index if not exists network_contacts_search_document_idx
on public.network_contacts using gin (search_document);

create index if not exists network_contacts_embedding_hnsw_idx
on public.network_contacts using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists network_import_runs_owner_started_idx
on public.network_import_runs (owner_id, started_at desc);

create or replace function public.refresh_network_contact_search_fields()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  next_search_text text;
begin
  new.full_name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
  if new.full_name is null then
    new.full_name := coalesce(nullif(trim(new.linkedin_url), ''), 'Unknown connection');
  end if;

  new.email := nullif(lower(trim(new.email)), '');
  new.source_email := nullif(lower(trim(new.source_email)), '');
  new.has_email := new.email is not null;
  if new.email is null then
    new.email_type := 'none';
  end if;

  next_search_text := trim(concat_ws(
    ' ',
    new.full_name,
    new.email,
    new.source_email,
    new.company,
    new.source_company,
    new.position,
    new.source_position,
    new.city,
    new.region,
    new.country,
    array_to_string(coalesce(new.work_categories, '{}'::text[]), ' '),
    array_to_string(coalesce(new.expertise_keywords, '{}'::text[]), ' '),
    array_to_string(coalesce(new.outreach_goals, '{}'::text[]), ' '),
    array_to_string(coalesce(new.tags, '{}'::text[]), ' '),
    new.relationship_context,
    new.public_summary,
    new.notes
  ));

  if tg_op = 'INSERT' or next_search_text is distinct from old.search_text then
    new.embedding_refresh_needed := true;
  end if;

  new.search_text := next_search_text;
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.full_name, '')), 'A') ||
    setweight(to_tsvector('simple', concat_ws(' ', new.company, new.source_company, new.position, new.source_position)), 'A') ||
    setweight(to_tsvector('simple', concat_ws(' ', new.email, new.source_email, new.city, new.region, new.country)), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.work_categories, '{}'::text[]), ' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.expertise_keywords, '{}'::text[]), ' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'::text[]), ' ')), 'C') ||
    setweight(to_tsvector('simple', concat_ws(' ', new.relationship_context, new.public_summary, new.notes)), 'D');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists refresh_network_contact_search_fields on public.network_contacts;
create trigger refresh_network_contact_search_fields
before insert or update on public.network_contacts
for each row
execute function public.refresh_network_contact_search_fields();

create or replace function public.search_network_contacts(
  p_owner_id uuid,
  p_query text default null,
  p_query_embedding extensions.vector(1536) default null,
  p_has_email boolean default null,
  p_email_type text default null,
  p_country text default null,
  p_region text default null,
  p_city text default null,
  p_company text default null,
  p_work_categories text[] default null,
  p_expertise_keywords text[] default null,
  p_outreach_goals text[] default null,
  p_relationship_tier text default null,
  p_tags text[] default null,
  p_verification_state text default null,
  p_enrichment_status text default null,
  p_newsletter_status text default null,
  p_do_not_contact boolean default null,
  p_connected_from date default null,
  p_connected_to date default null,
  p_include_archived boolean default false,
  p_sort text default 'relevance',
  p_offset integer default 0,
  p_limit integer default 100
)
returns table (
  contact jsonb,
  relevance_score double precision,
  match_reason text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with filtered as (
    select
      c.*,
      case
        when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision
        when lower(c.full_name) = lower(trim(p_query)) then 1.4
        when lower(c.full_name) like lower(trim(p_query)) || '%' then 1.1
        when c.search_document @@ websearch_to_tsquery('simple', trim(p_query))
          then ts_rank_cd(c.search_document, websearch_to_tsquery('simple', trim(p_query)))::double precision
        when c.search_text ilike '%' || trim(p_query) || '%' then 0.32
        else 0
      end as keyword_score,
      case
        when p_query_embedding is not null and c.embedding is not null
          then greatest(0, 1 - (c.embedding <=> p_query_embedding))
        else 0
      end::double precision as semantic_score
    from public.network_contacts c
    where
      c.owner_id = p_owner_id
      and (p_include_archived or not c.archived)
      and (p_has_email is null or c.has_email = p_has_email)
      and (p_email_type is null or c.email_type = p_email_type)
      and (p_country is null or coalesce(c.country, '') ilike p_country)
      and (p_region is null or coalesce(c.region, '') ilike p_region)
      and (p_city is null or coalesce(c.city, '') ilike p_city)
      and (p_company is null or coalesce(c.company, c.source_company, '') ilike '%' || p_company || '%')
      and (p_work_categories is null or c.work_categories && p_work_categories)
      and (p_expertise_keywords is null or c.expertise_keywords && p_expertise_keywords)
      and (p_outreach_goals is null or c.outreach_goals && p_outreach_goals)
      and (p_relationship_tier is null or c.relationship_tier = p_relationship_tier)
      and (p_tags is null or c.tags && p_tags)
      and (p_verification_state is null or c.verification_state = p_verification_state)
      and (p_enrichment_status is null or c.enrichment_status = p_enrichment_status)
      and (p_newsletter_status is null or c.newsletter_status = p_newsletter_status)
      and (p_do_not_contact is null or c.do_not_contact = p_do_not_contact)
      and (p_connected_from is null or c.connected_on >= p_connected_from)
      and (p_connected_to is null or c.connected_on <= p_connected_to)
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or c.search_text ilike '%' || trim(p_query) || '%'
        or c.search_document @@ websearch_to_tsquery('simple', trim(p_query))
        or (
          p_query_embedding is not null
          and c.embedding is not null
          and 1 - (c.embedding <=> p_query_embedding) > 0.18
        )
      )
  ),
  ranked as (
    select
      f.*,
      (
        f.keyword_score * 0.64 +
        f.semantic_score * 0.30 +
        case f.relationship_tier when 'strong' then 0.08 when 'familiar' then 0.04 else 0 end +
        case when f.starred then 0.08 else 0 end +
        case when f.verification_state = 'verified' then 0.03 else 0 end
      )::double precision as score,
      count(*) over() as matched_count
    from filtered f
  )
  select
    to_jsonb(r)
      - 'embedding'
      - 'search_document'
      - 'search_text'
      - 'import_snapshot'
      - 'employment_history'
      - 'public_links'
      - 'enrichment_sources'
      - 'confidence'
      - 'incoming_conflicts'
      - 'keyword_score'
      - 'semantic_score'
      - 'score'
      - 'matched_count' as contact,
    r.score as relevance_score,
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then null
      when r.full_name ilike '%' || trim(p_query) || '%' then 'Name match'
      when coalesce(r.company, r.source_company, '') ilike '%' || trim(p_query) || '%' then 'Company match'
      when coalesce(r.position, r.source_position, '') ilike '%' || trim(p_query) || '%' then 'Role match'
      when r.semantic_score > r.keyword_score then 'Semantic match to the search intent'
      else 'Relevant profile details match'
    end as match_reason,
    r.matched_count as total_count
  from ranked r
  order by
    case when p_sort = 'relevance' then r.score end desc nulls last,
    case when p_sort = 'connected_desc' then r.connected_on end desc nulls last,
    case when p_sort = 'connected_asc' then r.connected_on end asc nulls last,
    case when p_sort = 'name_asc' then lower(r.full_name) end asc nulls last,
    case when p_sort = 'name_desc' then lower(r.full_name) end desc nulls last,
    case when p_sort = 'company_asc' then lower(coalesce(r.company, r.source_company, '')) end asc nulls last,
    r.full_name asc
  offset greatest(0, p_offset)
  limit least(200, greatest(1, p_limit));
$$;

create or replace function public.network_contact_facets(p_owner_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.network_contacts where owner_id = p_owner_id and not archived),
    'withEmail', (select count(*) from public.network_contacts where owner_id = p_owner_id and not archived and has_email),
    'pendingEmbeddings', (select count(*) from public.network_contacts where owner_id = p_owner_id and not archived and embedding_refresh_needed),
    'enriched', (select count(*) from public.network_contacts where owner_id = p_owner_id and not archived and enrichment_status = 'enriched'),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object('value', company_name, 'count', item_count) order by item_count desc, company_name)
      from (
        select coalesce(company, source_company) as company_name, count(*) as item_count
        from public.network_contacts
        where owner_id = p_owner_id and not archived and coalesce(company, source_company) is not null
        group by coalesce(company, source_company)
        order by item_count desc
        limit 100
      ) companies
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('value', country_name, 'count', item_count) order by item_count desc, country_name)
      from (
        select coalesce(country, 'Unknown') as country_name, count(*) as item_count
        from public.network_contacts
        where owner_id = p_owner_id and not archived
        group by coalesce(country, 'Unknown')
        order by item_count desc
        limit 100
      ) countries
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('value', city_name, 'count', item_count) order by item_count desc, city_name)
      from (
        select coalesce(city, 'Unknown') as city_name, count(*) as item_count
        from public.network_contacts
        where owner_id = p_owner_id and not archived
        group by coalesce(city, 'Unknown')
        order by item_count desc
        limit 100
      ) cities
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('value', category, 'count', item_count) order by item_count desc, category)
      from (
        select category, count(*) as item_count
        from public.network_contacts, unnest(work_categories) category
        where owner_id = p_owner_id and not archived
        group by category
        order by item_count desc
      ) categories
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('value', tag, 'count', item_count) order by item_count desc, tag)
      from (
        select tag, count(*) as item_count
        from public.network_contacts, unnest(tags) tag
        where owner_id = p_owner_id and not archived
        group by tag
        order by item_count desc
        limit 100
      ) tags
    ), '[]'::jsonb),
    'lastImport', (
      select to_jsonb(run)
      from (
        select
          id, source_filename, status, total_rows, inserted_count, updated_count,
          unchanged_count, duplicate_count, failed_count, started_at, completed_at
        from public.network_import_runs
        where owner_id = p_owner_id
        order by started_at desc
        limit 1
      ) run
    )
  );
$$;

create or replace function public.update_network_contact_embeddings(
  p_owner_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
set statement_timeout = '45s'
as $$
declare
  item jsonb;
  updated_count integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    update public.network_contacts
    set
      embedding = (item->>'embedding')::extensions.vector(1536),
      embedding_model = nullif(item->>'model', ''),
      embedding_input_hash = nullif(item->>'hash', ''),
      embedded_at = now(),
      embedding_refresh_needed = false
    where owner_id = p_owner_id
      and id = (item->>'id')::uuid;
    if found then
      updated_count := updated_count + 1;
    end if;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.search_network_contacts(
  uuid, text, extensions.vector, boolean, text, text, text, text, text, text[], text[],
  text[], text, text[], text, text, text, boolean, date, date, boolean, text,
  integer, integer
) from public, anon, authenticated;
grant execute on function public.search_network_contacts(
  uuid, text, extensions.vector, boolean, text, text, text, text, text, text[], text[],
  text[], text, text[], text, text, text, boolean, date, date, boolean, text,
  integer, integer
) to service_role;

revoke all on function public.network_contact_facets(uuid) from public, anon, authenticated;
grant execute on function public.network_contact_facets(uuid) to service_role;

revoke all on function public.update_network_contact_embeddings(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.update_network_contact_embeddings(uuid, jsonb)
to service_role;
