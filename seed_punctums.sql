-- INSERT "INVISIBLE PUNCTUMS" PROJECT
-- Run this in Supabase SQL Editor.

insert into public.projects (
  slug, 
  title, 
  description, 
  tags, 
  link, 
  repo_link, 
  published,
  sort_order,
  content
) values (
  'invisible-punctums',
  'Invisible Punctums',
  'An Image Research Interface for Collecting Human Responses and AI-Driven Analysis.',
  ARRAY['Research', 'AI', 'Sociology', 'JavaScript'],
  'https://abodidsahoo.github.io/invisible-punctums', -- The Live Project
  'https://github.com/abodidsahoo/invisible-punctums', -- The Source Code
  true,
  1,
  E'# The Invisible Punctum\n\nThe project is fundamentally an extension of myself.\n\nThroughout my entire journey with photography, the most intimate moments have been those when I had the chance to engage in deeper conversations about a photograph with people. They share what they feel. I keep a note of it. I analyse why someone feels a certain way, and someone else feels the opposite at times.\n\n### What is the "Invisible Punctum"?\nDerived from the idea of "punctum" by Roland Barthes, I try to expand the concept by trying to find the "invisible punctum" in the photos. "Punctum", as Barthes says, is that one nuance in the image that punches. The part that hits you deep. The thing that makes you feel that "ahh" moment.\n\nThis project is a reflection of the overwhelming number of photographs we capture these days. It is a critical analysis of how we comfortably upload everything to the cloud and how we allow AI to deeply analyse it, impacting our daily life by selectively showing us back what it finds.\n\n### The Role of AI\nThis entire process of recalling through AI is basically after AI tries to find the meaning in them, which is fundamentally flawed, as shown in this research. And that means the way memories appear in phone applications is too fabricated, shallow, and constructed, lacking that much-needed human touch.\n\nAren''t we supposed to remind ourselves of what''s important to us and what we want to recall, instead of an AI deciding what we should remember?\n\n### The Research Interface\nI collect real human responses in this project using photos from my personal archive and professional projects, and try to figure out what people feel when they see them.\n\n- Write your feelings or record a voice note.\n- Checks responses by other people.\n- Compare human reactions vs AI analysis.\n- Choose either a Cloud Model or a Local Model.\n\nIn the last tab, you see a beautiful visualisation of the most commented images. The images which people selected the most number of times to comment on appear as the largest. You see them as floating bubbles, along with the human responses that occur around them.'
)
on conflict (slug) do update
set content = excluded.content, title = excluded.title;
