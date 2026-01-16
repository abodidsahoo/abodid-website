-- 1. Update Schema
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS categories text[],
ADD COLUMN IF NOT EXISTS roles text[];

-- 2. Clean Slate (Removes old "sample" data)
TRUNCATE TABLE public.films;

-- 3. Insert Fresh Data
INSERT INTO public.films (title, categories, roles, video_url, thumbnail_url, description, year, published)
VALUES
    ('Hermosa Design Studio - English Version', ARRAY['Brand Film'], ARRAY['Director','Editor','Creative Producer'], 'https://vimeo.com/1081726500', 'https://i.vimeocdn.com/video/2012566839-774c4d4d490c38ed760cee8888065763e0765d55c0e04df21927a51ff9216384-d_1280?region=us', 'Description for Hermosa Design Studio - English Version', 2024, true),
    ('Budweiser - Bud Banter Club', ARRAY['Brand Film','Experimental'], ARRAY['Editor'], 'https://vimeo.com/1081716668', 'https://i.vimeocdn.com/video/2012556863-f152bcc3cf63af75b3d96dab64ab97614b336af4790aa0f5ca7cf45847d9bb44-d_1280?region=us', 'Description for Budweiser - Bud Banter Club', 2024, true),
    ('Neon Xypher', ARRAY['Experimental','Visual Effects','Dance Film'], ARRAY['Director','Editor','DOP','VFX Artist','Sound Designer'], 'https://vimeo.com/414243593', 'https://i.vimeocdn.com/video/887222410-c09296ca3d1e10b99b49a9198b34805b0b18ff03cf8de3ef4ba276c866998d66-d_1280?region=us', 'Description for Neon Xypher', 2024, true),
    ('Bloombai', ARRAY['Fashion Film'], ARRAY['Director','Editor','Colorist'], 'https://vimeo.com/411314960', 'https://i.vimeocdn.com/video/883348295-59387b0c9a64c31dcda8ee19a2887cea9579d0ed448f95fcfec6b768b3ca96ba-d_1280?region=us', 'Description for Bloombai', 2024, true),
    ('Odisha Tourism', ARRAY['Travel Film','Advertising Campaign'], ARRAY['Director','Creative Producer','Editor','Colorist'], 'https://vimeo.com/265220711', 'https://i.vimeocdn.com/video/716261399-30c56c9f30375501fc1db56eabd2fbda9fb9a168e1cd2ea441982cf1d71020cc-d_1280?region=us', 'Description for Odisha Tourism', 2024, true),
    ('Guatemala Tourism', ARRAY['Travel Film'], ARRAY['Editor','Colorist','Sound Designer'], 'https://www.youtube.com/watch?v=M2qFEgO-qoc', 'https://img.youtube.com/vi/M2qFEgO-qoc/maxresdefault.jpg', 'Description for Guatemala Tourism', 2024, true),
    ('Hermosa Design Studio - Hindi Version', ARRAY['Brand Film'], ARRAY['Director','Editor','Creative Producer'], 'https://www.youtube.com/watch?v=EMsZT9PCFms', 'https://img.youtube.com/vi/EMsZT9PCFms/maxresdefault.jpg', 'Description for Hermosa Design Studio - Hindi Version', 2024, true),
    ('Budweiser Streetwear', ARRAY['Brand Film'], ARRAY['DOP','Editor','Colorist','Sound Designer'], 'https://vimeo.com/451507630?fl=pl&fe=vl', 'https://i.vimeocdn.com/video/946499546-64ec386edc7652e24ddd72cba8da15513467d4ed22f29b9aab261af291ffc3f4-d_1280?region=us', 'Description for Budweiser Streetwear', 2024, true),
    ('Show me the way (VH1 India)', ARRAY['Music Video'], ARRAY['Director','DOP','Editor','Colorist','VFX Artist'], 'https://www.youtube.com/watch?v=fooE0W_mFSY', 'https://img.youtube.com/vi/fooE0W_mFSY/maxresdefault.jpg', 'Description for Show me the way (VH1 India)', 2024, true),
    ('Love Edition - The Living Room Tour', ARRAY['Non-Fiction Storytelling'], ARRAY['Editor','Colorist','Motion Designer'], 'https://www.youtube.com/watch?v=DcAOTVnof6I', 'https://img.youtube.com/vi/DcAOTVnof6I/maxresdefault.jpg', 'Description for Love Edition - The Living Room Tour', 2024, true),
    ('Pride Edition - The Living Room Tour', ARRAY['Non-Fiction Storytelling'], ARRAY['Editor','Motion Designer','Colorist','Sound Mix'], 'https://www.youtube.com/watch?v=tSVvI_nMZD8', 'https://img.youtube.com/vi/tSVvI_nMZD8/maxresdefault.jpg', 'Description for Pride Edition - The Living Room Tour', 2024, true),
    ('The Living Room Tour - Sizzle', ARRAY['Advertising Campaign'], ARRAY['Editor','Sound Designer','Creative Conceptualiser'], 'https://www.youtube.com/watch?v=ooxxgMCX-HY', 'https://img.youtube.com/vi/ooxxgMCX-HY/maxresdefault.jpg', 'Description for The Living Room Tour - Sizzle', 2024, true),
    ('Educate Girls - Sovni', ARRAY['Documentary','Non-Fiction Storytelling'], ARRAY['Editor','Colorist','Sound Designer'], 'https://www.youtube.com/watch?v=rgi6gSZiWqE', 'https://img.youtube.com/vi/rgi6gSZiWqE/maxresdefault.jpg', 'Description for Educate Girls - Sovni', 2024, true),
    ('Educate Girls - Monica', ARRAY['Documentary','Non-Fiction Storytelling'], ARRAY['Editor','Colorist','Sound Designer'], 'https://www.youtube.com/watch?v=LwUfhr4hB5Y', 'https://img.youtube.com/vi/LwUfhr4hB5Y/maxresdefault.jpg', 'Description for Educate Girls - Monica', 2024, true),
    ('Jawa Motorcycles - Ad Film BTS', ARRAY['Advertising Campaign'], ARRAY['Editor','Sound Designer','Colorist'], 'https://www.youtube.com/watch?v=CSmZHXpr13E', 'https://img.youtube.com/vi/CSmZHXpr13E/maxresdefault.jpg', 'Description for Jawa Motorcycles - Ad Film BTS', 2024, true),
    ('The Jawa Experience - Rajasthan', ARRAY['Advertising Campaign'], ARRAY['Editor','Sound Designer','Colorist'], 'https://www.youtube.com/watch?v=SYUQyPzpwhA', 'https://img.youtube.com/vi/SYUQyPzpwhA/maxresdefault.jpg', 'Description for The Jawa Experience - Rajasthan', 2024, true);