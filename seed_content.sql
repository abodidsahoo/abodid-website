-- SAMPLE CONTENT SEED SCRIPT
-- Run this in Supabase SQL Editor to instantly create a rich blog post.

insert into public.posts (slug, title, excerpt, published_at, published, cover_image, content)
values (
  'welcome-to-digital-garden', -- This determines the URL: /blog/welcome-to-digital-garden
  'Welcome to my Digital Garden',
  'A first look at my new portfolio, built with Astro, Supabase, and a focus on storytelling.',
  now(),
  true,
  'https://images.unsplash.com/photo-1492551557933-34265f7af813?q=80&w=1920&auto=format&fit=crop',
  '# The Intersection of Code & Film

Welcome to my new digital home. I wanted a space that felt less like a resume and more like a **gallery**.

## Why I Built This
Most portfolios are static. They sit there. I wanted something that felt *alive*.
Using **Astro**, I ensure the site is incredibly fast. Using **Supabase**, I can update it from my phone without touching code.

### The Stack
- **Frontend**: Astro (Static Site Generation)
- **Backend**: Supabase (PostgreSQL)
- **Styling**: Vanilla CSS (No frameworks, pure control)

## Photography & Storytelling
> "Photography is the story I fail to put into words." — Destin Sparks

Full photo stories will live in the Portfolio section, but I will use this journal to document the *process* behind the shots.

![Camera](https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1920&auto=format&fit=crop)

Stay tuned for more updates.'
)
on conflict (slug) do update 
set content = excluded.content, title = excluded.title;
