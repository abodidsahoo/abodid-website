-- Table for curated named color dictionary and OKLab color space values
create table if not exists public.named_color_dictionary (
    id serial primary key,
    name text not null,
    hex varchar(7) not null unique,
    oklab_l numeric(8,6) not null,
    oklab_a numeric(8,6) not null,
    oklab_b numeric(8,6) not null,
    category text,
    created_at timestamptz default now()
);

-- Indexes for rapid lookup and color distance queries
create index if not exists idx_named_color_hex on public.named_color_dictionary(hex);
create index if not exists idx_named_color_oklab on public.named_color_dictionary(oklab_l, oklab_a, oklab_b);

-- Enable RLS
alter table public.named_color_dictionary enable row level security;

-- Public read access
create policy "Allow public read on named_color_dictionary"
    on public.named_color_dictionary
    for select
    to anon, authenticated
    using (true);
