-- =====================================================
-- BACKUP OF HARDCODED BLOG POSTS
-- =====================================================
-- This file contains SQL INSERT statements for blog posts
-- that were previously hardcoded in src/lib/api.js
-- You can use these to import the content into your Supabase 'blog' table
-- 
-- Usage:
-- 1. Review the content below
-- 2. Run these INSERT statements in your Supabase SQL editor
-- 3. Adjust the 'published_at' dates as needed
-- =====================================================

-- Blog Post 1: How Apple Funded My Dream at RCA
-- Status: REMOVED from hardcode (now fetches from Supabase)
INSERT INTO blog (
    slug,
    title,
    excerpt,
    content,
    published_at,
    published,
    category,
    tags,
    cover_image
) VALUES (
    'how-apple-funded-my-dream-at-rca',
    'How Apple Funded My Dream at RCA',
    'In August 2022, a single email changed the trajectory of my life. Apple stepped in with a full scholarship that covered every penny of my £28,000 tuition.',
    'In August 2022, a single email changed the trajectory of my life. I had been accepted into the Royal College of Art in London but was struggling to figure out how I would pay for it. Then Apple stepped in, with a full scholarship. It covered every penny of my £28,000 tuition. The timing? Just a few weeks before term started. That close. It was wild!!!

I didn''t just study thanks to that scholarship, I lived. I walked into galleries, music gigs, therapy conversations, deep dives into auto-ethnography and emotional research.

I photographed everything. I asked questions about love, grief, relationships, and healing.
I made art. I found space.

That one year gave me freedom, not just from fees, but from fear.
If there''s one thing in my life I still have to pinch myself to believe, it''s this: **Apple paid for my master''s in the Royal College of Art, London.** Not just a stipend. Not a partial fee cut. The whole damn thing. Twenty-eight thousand pounds!! Deuymm!!!

When the email landed in my inbox, I remember sitting in stunned silence. Everything around me blurred. It was the first time in years I truly believed that anything could happen. Any f**king thing. I had written to them about my financial constraints, my social background, my dreams, my work. I explained. I didn''t have the answers. I just had urgency. And somehow, that was enough.

That scholarship didn''t just give me education. It gave me time. I went to every art exhibition I could find. Every music gig. I documented RCA obsessively. I explored London like someone finally allowed to breathe. I tried new technologies. I printed endlessly. I poured my energy into conversations about healing, therapy, identity, loneliness, and connection.

I researched mental health and human behaviour using myself as the subject. I used visual tools, experimental writing, soundscapes, and photos as methods of inquiry. That''s what the scholarship gave me, the freedom to go deep.

If I had paid that money in tuition, I would''ve never had this freedom. I''d have been budgeting every decision. Instead, I spent my loan on living. On learning. This year wasn''t perfect. But it was expansive.',
    '2023-09-01 00:00:00+00',
    true,
    ARRAY['Personal', 'Scholarships'],
    ARRAY['Apple', 'RCA', 'Scholarship', 'London'],
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=1000'
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    published_at = EXCLUDED.published_at,
    published = EXCLUDED.published,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    cover_image = EXCLUDED.cover_image;

-- Blog Post 2: Everything You Need to Know About Scholarships for Higher Studies
-- Status: REMOVING from hardcode (will fetch from Supabase after this)
INSERT INTO blog (
    slug,
    title,
    excerpt,
    content,
    published_at,
    published,
    category,
    tags,
    cover_image
) VALUES (
    'scholarships-for-higher-studies',
    'Everything You Need to Know About Scholarships for Higher Studies',
    'A comprehensive guide to scholarships for international students, including Aga Khan, Charles Wallace, and more.',
    'Securing funding for higher education in art and design can be daunting, but there are numerous opportunities available for international students. Here is a curated list of scholarships and funding bodies to help you pursue your dreams.

## Global & UK Specific Scholarships

### Aga Khan Foundation''s International Scholarship Programme (AKF ISP)
The Aga Khan Foundation provides a limited number of scholarships each year for postgraduate studies to outstanding students from select developing countries who have no other means of financing their studies.

### Charles Wallace India Trust Scholarships
For Indians to gain experience and deeper exposure to the arts and heritage conservation in the UK.

### Commonwealth Master''s Scholarships
Funded by the UK Foreign, Commonwealth & Development Office (FCDO), these scholarships enable talented and motivated individuals to gain the knowledge and skills required for sustainable development.

### Inlaks Scholarships
The Inlaks Shivdasani Foundation offers scholarships for young Indians to take up higher studies at top-rated American, European, and UK institutions.

## Other Notable Funds
- **Education Future International Scholarship**: For Indian students studying abroad.
- **JND TATA Endowment**: Loan scholarships for higher studies.
- **Lady Meherbai D Tata Education Trust**: For Indian women graduates.
- **KC Mahindra Trust Foundation**: Interest-free loan scholarships.
- **The Narotam Sekhsaria Foundation**: Interest-free scholarship loans.
- **National Overseas Scholarships**: Facilitated by the Ministry of Social Justice and Empowerment.

## Search Portals
These platforms are excellent resources for finding tailored opportunities:
- [MastersCompare](https://www.masterscompare.com)
- [FindAMasters](https://www.findamasters.com)
- [TopUniversities](https://www.topuniversities.com)
- [Postgrad Solutions](https://www.postgrad.com)
- [MastersPortal](https://www.mastersportal.com)
- [Chevening Scholarships](https://www.chevening.org)
- [Educations.com](https://www.educations.com)

## My Journey
I was fortunate enough to receive a full scholarship from Apple for my time at the RCA. It changed everything for me. You can read more about my personal experience here:

[**How Apple Funded My Dream at RCA**](/blog/how-apple-funded-my-dream-at-rca)

And check out my [Awards Page](/awards/apple-scholarship) for more details.',
    NOW(),
    true,
    ARRAY['Resources', 'Scholarships'],
    ARRAY['Funding', 'Masters', 'Study Abroad'],
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    published_at = EXCLUDED.published_at,
    published = EXCLUDED.published,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    cover_image = EXCLUDED.cover_image;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. These INSERT statements use ON CONFLICT to update existing rows
--    if the slug already exists in your database
-- 2. If you already have these posts in Supabase with your own content,
--    DO NOT run these queries as they will overwrite your content
-- 3. Adjust 'published_at' dates to match your desired publish dates
-- 4. NULL cover_image means no image - add your own image URLs if needed
-- =====================================================
