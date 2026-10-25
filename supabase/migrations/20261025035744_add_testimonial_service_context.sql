alter table public.testimonials add column if not exists service_context text;
comment on column public.testimonials.service_context is 'Brief factual context for the work or guidance discussed in the testimonial; does not imply a paid engagement.';
