-- Insert Media Mentions Safely
-- Uses dynamic cover images from your existing 'blog' and 'photography' tables.
-- This ensures the images are your actual work/blog covers.

-- Helper Note: We use a subquery to pick a random image from your content tables.
-- (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)

-- Press Mentions
INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Inner Peace (2023 Pavilion)', 'London Design Biennale', 'https://londondesignbiennale.com/pavilions/2023/inner-peace', ARRAY['Press', 'Exhibition'], '2023-06-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Inner Peace (2023 Pavilion)');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Feature on Homegrown', 'Homegrown', '#', ARRAY['Press', 'Feature'], NOW(), 
       (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Feature on Homegrown');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Feature in Rolling Stone', 'Rolling Stone India', '#', ARRAY['Press', 'Feature'], NOW(), 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Feature in Rolling Stone');

-- Collaborative Works
INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Buddhi from the Duplication', 'Collaboration with Yu-Ting', 'https://tingchzy.net/work-workshop-artist-book/scroll-buddhi-from-the-duplication-no-illusion-in-the-wind/', ARRAY['Collaboration', 'Art'], '2024-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Buddhi from the Duplication');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Moving Abodid', 'Theo Leonowicz (RCA)', 'https://theoleon.uk/moving-abodid', ARRAY['Collaboration', 'Photography'], '2024-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Moving Abodid');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Breathe Variations', 'Christopher Steenson (Flat Time House)', 'https://christophersteenson.com/breath-variations', ARRAY['Collaboration', 'Commission'], '2023-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Breathe Variations');

-- Professional Works
INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Exhibition Design Support', 'Royal College of Art', 'https://2024.rca.ac.uk/', ARRAY['Work', 'Technical', 'Design'], '2024-06-01', 
       (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Exhibition Design Support');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Into the Flux (Production & Photography)', 'International Body of Art', 'https://iba.art', ARRAY['Work', 'Production', 'Photography'], '2024-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Into the Flux (Production & Photography)');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Furnmill Brand Film', 'Hermosa Design Studio', 'https://www.youtube.com/watch?v=EMsZT9PCFms', ARRAY['Work', 'Direction', 'Film'], '2021-01-01', 
       (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Furnmill Brand Film');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Lyric Videos for Alonzo', 'Alonzo Music', 'https://www.youtube.com/c/alonzomusic', ARRAY['Work', 'Motion Design'], '2020-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Lyric Videos for Alonzo');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Budweiser Streetwear Campaign', 'Budweiser (Agency: Animal)', 'https://www.weareanimal.co/budweiser-streetwear', ARRAY['Work', 'Direction', 'Film'], '2021-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Budweiser Streetwear Campaign');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Concept Films (Love & Queerness)', 'Pursuit of Portraits', 'https://www.pursuitofportraits.com/', ARRAY['Work', 'Creative Direction'], '2020-01-01', 
       (SELECT cover_image FROM photography WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Concept Films (Love & Queerness)');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Video Consultant', 'Likeminds', 'https://likeminds.in/', ARRAY['Work', 'Consulting'], '2021-01-01', 
       (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Video Consultant');

INSERT INTO media_mentions (title, publication, url, categories, published_at, image_url)
SELECT 'Football Banter Web Episode', 'Budweiser (Agency: W+K)', 'https://www.wk.com/', ARRAY['Work', 'Editing'], '2020-01-01', 
       (SELECT cover_image FROM blog WHERE cover_image IS NOT NULL ORDER BY random() LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM media_mentions WHERE title = 'Football Banter Web Episode');
