-- Testimonials (Client/Colleague Feedback)
create table if not exists public.testimonials (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  role text,    -- Optional: "Senior Editor", "Creative Director"
  company text, -- Optional: "Vogue", "Freelance"
  content text not null,
  is_approved boolean default true, -- Auto-approve as requested ("directly appear")
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.testimonials enable row level security;

-- Public can VIEW all approved testimonials
create policy "Public view approved testimonials" on public.testimonials
  for select using (is_approved = true);

-- Public can INSERT testimonials
create policy "Public insert testimonials" on public.testimonials
  for insert with check (true);

-- Only Admin can UPDATE/DELETE (Moderation)
create policy "Admin manage testimonials" on public.testimonials
  for all using (auth.role() = 'authenticated');
