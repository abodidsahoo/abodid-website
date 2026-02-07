
-- TRUNCATE table to remove all previous test data
TRUNCATE TABLE photo_feedback;

-- 1. ANGRY ZONE: Into the Flux
-- Focus: Anger / Irritation (A1)
INSERT INTO photo_feedback (image_url, feeling_text) VALUES 
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/photography/covers/1768216682836-into-the-flux-iba-london88.jpg', 'Really annoyed'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/photography/covers/1768216682836-into-the-flux-iba-london88.jpg', 'So frustrated'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/photography/covers/1768216682836-into-the-flux-iba-london88.jpg', 'Pretty angry'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/photography/covers/1768216682836-into-the-flux-iba-london88.jpg', 'Feels unfair');

-- 2. HAPPY ZONE: Outernet London 2025
-- Focus: Joy / Excitement (H1)
INSERT INTO photo_feedback (image_url, feeling_text) VALUES 
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769335283887_0d9he7ekd.jpg', 'Really happy'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769335283887_0d9he7ekd.jpg', 'So excited'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769335283887_0d9he7ekd.jpg', 'Feels amazing'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769335283887_0d9he7ekd.jpg', 'Super joyful');

-- 3. SAD ZONE: Yu-Ting Blinded in London Overground
-- Focus: Sad / Down (D1)
INSERT INTO photo_feedback (image_url, feeling_text) VALUES 
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769342406110_82o2dyerw.jpg', 'Feeling sad'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769342406110_82o2dyerw.jpg', 'Pretty down'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769342406110_82o2dyerw.jpg', 'Low mood'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769342406110_82o2dyerw.jpg', 'Not okay');

-- 4. CALM ZONE: Vaneesha birthday in Kent
-- Focus: Peace / Relaxation (C1)
INSERT INTO photo_feedback (image_url, feeling_text) VALUES 
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769341088685_pv1i08koe.jpg', 'Feeling calm'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769341088685_pv1i08koe.jpg', 'Very relaxed'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769341088685_pv1i08koe.jpg', 'At peace'),
('https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769341088685_pv1i08koe.jpg', 'Nice and quiet');
