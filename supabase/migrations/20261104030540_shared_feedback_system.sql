-- Shared feedback storage; legacy DU rows remain as a recovery copy.
begin;

create table public.feedback_forms (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    institution_slug text not null check (institution_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    institution_name text not null,
    event_slug text not null check (event_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    event_title text not null,
    event_date date,
    form_version integer not null default 1 check (form_version > 0),
    questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 30),
    content jsonb not null check (jsonb_typeof(content) = 'object'),
    is_open boolean not null default true,
    responses_public boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (institution_slug, event_slug)
);

create table public.feedback_responses (
    id uuid primary key default gen_random_uuid(),
    form_id uuid not null references public.feedback_forms(id) on delete restrict,
    submission_key uuid not null default gen_random_uuid(),
    form_version integer not null check (form_version > 0),
    participant_name text check (char_length(participant_name) <= 180),
    participant_email text check (char_length(participant_email) <= 254),
    newsletter_consent boolean not null default false,
    answers jsonb not null check (jsonb_typeof(answers) = 'object' and answers <> '{}'::jsonb),
    question_snapshot jsonb not null check (jsonb_typeof(question_snapshot) = 'array' and jsonb_array_length(question_snapshot) > 0),
    submission_status text not null default 'received' check (submission_status in ('received', 'reviewed', 'archived', 'spam')),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (form_id, submission_key)
);
create index feedback_responses_form_created_idx on public.feedback_responses (form_id, created_at desc, id desc);
create index feedback_responses_status_created_idx on public.feedback_responses (submission_status, created_at desc);

alter table public.feedback_forms enable row level security;
alter table public.feedback_responses enable row level security;
-- Public requests go through validated server routes, never direct table access.
revoke all on public.feedback_forms, public.feedback_responses from public, anon, authenticated;
grant all on public.feedback_forms, public.feedback_responses to service_role;

create schema if not exists feedback_private;
revoke all on schema feedback_private from public, anon, authenticated;
grant usage on schema feedback_private to service_role;
create function feedback_private.touch_feedback()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
revoke all on function feedback_private.touch_feedback() from public, anon, authenticated;
grant execute on function feedback_private.touch_feedback() to service_role;
create trigger feedback_responses_updated before update on public.feedback_responses
for each row execute function feedback_private.touch_feedback();

create function feedback_private.version_form()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
    new.updated_at = now();
    if new.questions is distinct from old.questions then
        new.form_version = old.form_version + 1;
    else
        new.form_version = old.form_version;
    end if;
    return new;
end;
$$;
revoke all on function feedback_private.version_form() from public, anon, authenticated;
grant execute on function feedback_private.version_form() to service_role;
create trigger feedback_forms_updated before update on public.feedback_forms
for each row execute function feedback_private.version_form();

insert into public.feedback_forms (slug,institution_slug,institution_name,event_slug,event_title,event_date,questions,content) values (
    'delhi-university-ethnographic-filmmaking',
    'delhi-university',
    'University of Delhi',
    'ethnographic-filmmaking',
    'Ethnographic Filmmaking Workshop',
    null,
    '[{"id": "best_part", "label": "What was the best part?", "shortLabel": "Best Part", "type": "textarea", "placeholder": "Tell me what felt useful, interesting, memorable, or worth keeping."}, {"id": "improvements", "label": "What could have been improved?", "shortLabel": "Improvements", "type": "textarea", "placeholder": "Share anything that needed more time, clarity, structure, or examples."}, {"id": "future_workshop_topics", "label": "What would you love to learn in a future workshop?", "shortLabel": "Future Topics", "type": "textarea", "placeholder": "Topics, tools, exercises, readings, film practices, or questions you want explored next."}, {"id": "other_comments", "label": "Any other comments?", "shortLabel": "Other Comments", "type": "textarea", "placeholder": "Anything else you would like to share."}]'::jsonb,
    '{"kicker": "Delhi University Workshop", "heading": "Thank you for joining the ethnographic filmmaking workshop.", "note": "I am grateful for the questions, attention, and active participation you brought into the room. It was lovely to see the workshop come alive through your responses.", "thanks": "Warm thanks to Dr. Pratyasha Sahoo for inviting me to conduct this workshop.", "resourceNote": "Share your feedback to download the workshop slide deck.", "formNote": "Answer any one question, or all four. Name and email are optional.", "successNote": "I really appreciate you taking the time to respond. Your feedback helps me understand what was useful, what could be clearer, and what future workshops can hold.", "resources": [{"label": "Download Slide Deck (PDF)", "url": "https://assets.abodid.com/documents/Ethnographic-Filmmaking-Workshop-by-Abodid-Sahoo-for-Delhi-University-Send-to-Students.pdf"}], "image": "/images/og/du-workshop-feedback.png", "legacyStorageKey": "du_workshop_feedback_submitted_v1"}'::jsonb
);

insert into public.feedback_forms (slug,institution_slug,institution_name,event_slug,event_title,event_date,questions,content) values (
    'nift-bhubaneswar-space-materiality-2026-11-03',
    'nift-bhubaneswar',
    'NIFT Bhubaneswar',
    'space-materiality-2026-11-03',
    'Space and Materiality — Material Manipulation with a Focus on Prop Design; Window Design & Budgeting',
    '2026-11-03',
    '[{"id": "best_part", "label": "What stayed with you from the session?", "shortLabel": "What Stayed", "type": "textarea", "placeholder": "A window display idea, a material or prop, the Tanishq case study, or the tessellation demo…"}, {"id": "industry_takeaway", "label": "What felt useful about the industry workflow and budgeting discussion?", "shortLabel": "Industry & Budgeting", "type": "textarea", "placeholder": "Anything about design decisions, logistics, constraints, or budgets that clicked for you."}, {"id": "improvements", "label": "What could have been better?", "shortLabel": "Improvements", "type": "textarea", "placeholder": "Something you wanted more time, clarity, or practice with."}, {"id": "future_topics", "label": "What would you like to explore next?", "shortLabel": "Explore Next", "type": "textarea", "placeholder": "A topic, tool, material, exercise—or anything else you would like to share."}]'::jsonb,
    '{"kicker": "NIFT Bhubaneswar · 3 November 2026", "heading": "Thank you for joining the Space and Materiality session.", "note": "It was lovely spending the day with you, sharing ideas around window displays, props, materials, and how things come together in practice.", "thanks": "A warm thank-you to Shilpa Jena for inviting me, and to the Fashion Communication students for joining in.", "resourceNote": "Share a little feedback, then revisit both slide decks and the tessellation demo.", "formNote": "Answer whichever questions you like. Name and email are optional.", "successNote": "Thanks for sharing your thoughts. I hope a few ideas find their way into your next project. Here are the decks and demo we explored together.", "resources": [{"label": "The Retail Window", "url": "https://pitch.com/v/the-retail-window-magxqs", "description": "Storefronts, materials, props, and offbeat window display ideas."}, {"label": "Tanishq Bhubaneswar — Case Study", "url": "https://pitch.com/v/tanishq-bhubaneswar-case-study-37jr7a", "description": "The October 2026 flagship store: design workflow, logistics, constraints, and budgeting."}, {"label": "Try the Tessellation Demo", "url": "https://tiled.art/en/art/TurtleIsland/", "description": "Explore how a single tile becomes a repeating pattern."}]}'::jsonb
);

-- Capture old-site submissions during rollout; generated UUIDs are looked up by slug.
create function feedback_private.mirror_du_response()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
    insert into public.feedback_responses (
        id, form_id, submission_key, form_version, participant_name, participant_email,
        newsletter_consent, answers, question_snapshot, submission_status, metadata, created_at, updated_at
    )
    select new.id, form.id, new.id, 1, new.participant_name, new.participant_email,
        new.newsletter_consent,
        jsonb_strip_nulls(jsonb_build_object(
            'best_part', new.best_part, 'improvements', new.improvements,
            'future_workshop_topics', new.future_workshop_topics, 'other_comments', new.other_comments
        )), form.questions, new.submission_status,
        new.metadata || jsonb_build_object('legacy_table', 'du_workshop_feedback', 'legacy_workshop_slug', new.workshop_slug),
        new.created_at, new.updated_at
    from public.feedback_forms form where form.slug = 'delhi-university-ethnographic-filmmaking'
    on conflict (id) do update set
        participant_name = excluded.participant_name, participant_email = excluded.participant_email,
        newsletter_consent = excluded.newsletter_consent, answers = excluded.answers,
        submission_status = excluded.submission_status, metadata = excluded.metadata;
    return new;
end;
$$;
revoke all on function feedback_private.mirror_du_response() from public, anon, authenticated;
grant execute on function feedback_private.mirror_du_response() to service_role;
create trigger du_feedback_shared_storage after insert or update on public.du_workshop_feedback
for each row execute function feedback_private.mirror_du_response();

insert into public.feedback_responses (
    id, form_id, submission_key, form_version, participant_name, participant_email, newsletter_consent,
    answers, question_snapshot, submission_status, metadata, created_at, updated_at
)
select old.id, form.id, old.id, 1, old.participant_name, old.participant_email, old.newsletter_consent,
    jsonb_strip_nulls(jsonb_build_object(
        'best_part', old.best_part, 'improvements', old.improvements,
        'future_workshop_topics', old.future_workshop_topics, 'other_comments', old.other_comments
    )), form.questions, old.submission_status,
    old.metadata || jsonb_build_object('legacy_table', 'du_workshop_feedback', 'legacy_workshop_slug', old.workshop_slug),
    old.created_at, old.updated_at
from public.du_workshop_feedback old
join public.feedback_forms form on form.slug = 'delhi-university-ethnographic-filmmaking'
on conflict (id) do nothing;

-- Abort the complete migration if any original DU response is not represented exactly.
do $$
begin
    if exists (
        select 1 from public.du_workshop_feedback old
        left join public.feedback_responses response on response.id = old.id
        where response.id is null or response.participant_name is distinct from old.participant_name
            or response.participant_email is distinct from old.participant_email
            or response.newsletter_consent is distinct from old.newsletter_consent
            or response.created_at is distinct from old.created_at
            or response.updated_at is distinct from old.updated_at
            or response.submission_status is distinct from old.submission_status
            or response.answers is distinct from jsonb_strip_nulls(jsonb_build_object(
                'best_part', old.best_part, 'improvements', old.improvements,
                'future_workshop_topics', old.future_workshop_topics, 'other_comments', old.other_comments
            ))
    ) then raise exception 'DU response migration verification failed'; end if;
end;
$$;

comment on table public.feedback_forms is 'One configurable form per institution/event or general feedback collection. Stable UUIDs and globally unique URL slugs.';
comment on table public.feedback_responses is 'Shared feedback submissions for every collection. JSON answers use stable question IDs; snapshots preserve the questions as answered.';
comment on column public.feedback_responses.submission_key is 'Idempotency UUID: retries of the same form submission return the existing response.';
comment on column public.feedback_forms.responses_public is 'Whether the dedicated server-rendered response collection is visible to visitors; never grants direct database access.';
notify pgrst, 'reload schema';
commit;
