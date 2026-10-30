-- Product announcements are a separate, explicit preference, never inferred from sign-in.
-- Retain the membership table's existing service-only grants and forced RLS.
begin;

alter table public.opportunity_memberships
  add column product_updates_opt_in boolean not null default false,
  add column product_updates_email text,
  add column product_updates_opt_in_at timestamptz,
  add column product_updates_opt_out_at timestamptz,
  add column product_updates_consent_version text,
  add column product_updates_consent_text text,
  add column product_updates_consent_source text;

alter table public.opportunity_memberships
  add constraint opportunity_product_updates_affirmative_consent check (
    not product_updates_opt_in or (
      product_updates_email is not null
      and product_updates_opt_in_at is not null
      and product_updates_consent_version is not null
      and product_updates_consent_text is not null
      and product_updates_consent_source is not null
      and product_updates_consent_source in ('onboarding', 'profile')
    )
  );

comment on column public.opportunity_memberships.product_updates_opt_in is
  'Explicit product-announcement consent. Default false; Google sign-in and general newsletter membership do not imply consent.';
comment on column public.opportunity_memberships.product_updates_email is
  'Verified account email at opt-in. Announcements must also require it to match the current verified auth.users email.';

commit;
