-- UPDATE Media Mentions with Cover Images (Robust Version)
-- 1. Tries to pick a random image from your 'photography' or 'blog' tables.
-- 2. If valid image not found, falls back to a high-quality Unsplash image to GUARANTEE visibility.
-- 3. Updates rows individually to ensure variety.

-- Unsplash Fallbacks (Architecture/Art/Design themed)
-- Fallback 1: https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&q=80&w=600
-- Fallback 2: https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=600
-- Fallback 3: https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600

-- Press Mentions
UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Inner Peace (2023 Pavilion)';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Feature on Homegrown';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Feature in Rolling Stone';

-- Collaborative Works
UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600'
)
WHERE title = 'Buddhi from the Duplication';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=600'
)
WHERE title = 'Moving Abodid';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=600'
)
WHERE title = 'Breathe Variations';

-- Professional Works
UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Exhibition Design Support';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1550963300-34ccf43cd89e?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Into the Flux (Production & Photography)';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Furnmill Brand Film';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Lyric Videos for Alonzo';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1571597438462-8e8418f460d8?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Budweiser Streetwear Campaign';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Concept Films (Love & Queerness)';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Video Consultant';

UPDATE media_mentions 
SET image_url = COALESCE(
    (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1),
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=600'
)
WHERE title = 'Football Banter Web Episode';

-- Final Safety Net: If ANY row still has a NULL image (e.g. title mismatch), fix it with a generic one
UPDATE media_mentions 
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=600'
WHERE image_url IS NULL;
