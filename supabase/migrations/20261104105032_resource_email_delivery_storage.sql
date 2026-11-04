begin;
create table public.feedback_resource_deliveries (
    id uuid primary key default gen_random_uuid(),
    form_id uuid not null references public.feedback_forms(id) on delete restrict,
    response_id uuid not null references public.feedback_responses(id) on delete cascade,
    request_key uuid not null,
    recipient_email text not null check (char_length(recipient_email) between 3 and 254),
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    delivery_status text not null default 'pending' check (delivery_status in ('pending','sending','sent','failed')),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    first_attempt_at timestamptz,
    lease_until timestamptz,
    provider_id text,
    error_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (form_id, request_key)
);
alter table public.feedback_resource_deliveries enable row level security;
revoke all on public.feedback_resource_deliveries from public, anon, authenticated;
grant all on public.feedback_resource_deliveries to service_role;
comment on table public.feedback_resource_deliveries is 'Server-only resource mail receipts. Every email is linked to saved feedback. Frozen payloads and provider idempotency prevent retry duplicates; no public read policies.';


notify pgrst, 'reload schema';
commit;
