-- ============================================
-- Research Table Cleanup & Restructure
-- ============================================
-- This script will:
-- 1. Add visibility column (if not exists)
-- 2. Remove redundant href column
-- 3. Insert/update the 5 key research projects
-- 4. Set correct slugs that match your Astro pages
-- ============================================

-- Step 1: Add visibility column if it doesn't exist
ALTER TABLE research 
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Step 2: Update any existing rows to be visible by default
UPDATE research 
SET visible = true 
WHERE visible IS NULL;

-- Step 3: Remove the redundant href column (slug now controls URLs)
ALTER TABLE research 
DROP COLUMN IF EXISTS href;

-- Step 4: Clear existing data and insert the 5 key projects
-- First, delete all existing research projects to start fresh
TRUNCATE TABLE research;

-- Step 5: Insert the 5 key research projects with correct slugs
INSERT INTO research (title, description, slug, cover_image, tags, published, visible, sort_order)
VALUES
    -- 1. Polaroids Table (experiment page)
    (
        'Polaroids Table',
        'An interactive photo arrangement experiment—handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning. A stepping stone for designing photo books.',
        'polaroids-table',
        'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Photography', 'Interaction Design', 'In Progress'],
        true,
        true,
        1
    ),
    
    -- 2. The Second Brain (explanation page → launches obsidian vault)
    (
        'The Second Brain',
        'My personal Obsidian vault, a digital garden of interconnected thoughts, notes, and research.',
        'second-brain',
        'https://images.unsplash.com/photo-1456324504439-367cee10123c?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Knowledge Graph', 'Obsidian', 'Second Brain'],
        true,
        true,
        2
    ),
    
    -- 3. Invisible Punctums (explanation page → launches old/new versions)
    (
        'Invisible Punctums',
        'An AI-driven exploration of human memory, data, and the gaps in our digital archives.',
        'invisible-punctum-explanation',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000',
        ARRAY['AI', 'Memory', 'Data Vis'],
        true,
        true,
        3
    ),
    
    -- 4. LLM-based Chatbot (experiment page)
    (
        'LLM-based Chatbot',
        'Experimenting with OpenRouter API to build an internal chatbot trained on my research papers and creative work. Using selective free-tier models to create AI-driven tools for analyzing social data.',
        'llm-chatbot',
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
        ARRAY['OpenRouter API', 'AI Tools', 'In Progress'],
        true,
        true,
        4
    ),
    
    -- 5. Do Ghosts Feel Jealous? (explanation page → launches external case study)
    (
        'Do ghosts feel jealous if you miss the living ones more than them?',
        'Blurring the lines between the living and the dead, this project was a way to decode my minute emotional gestures around the dissonance between absence and presence.',
        'do-ghosts-feel-jealous',
        'https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Photography', 'Writing', 'Performance', 'Film'],
        true,
        true,
        5
    );

-- Step 6: Verify the changes
SELECT 
    title,
    slug,
    '/research/' || slug as generated_url,
    visible,
    published,
    sort_order
FROM research 
ORDER BY sort_order;

-- ============================================
-- Summary of URL Structure:
-- ============================================
-- ALL 5 projects in the research gallery are EXPLANATION PAGES
-- Each explanation page has a button/link to launch the actual experiment
-- 
-- Card clicks go to: /research/{slug}
-- 
-- 1. polaroids-table → /research/polaroids-table
--    (Explanation page with "Launch the experiment →" button)
-- 
-- 2. second-brain → /research/second-brain
--    (Explanation page with "Launch the experiment →" button to /research/obsidian-vault)
-- 
-- 3. invisible-punctum-explanation → /research/invisible-punctum-explanation
--    (Explanation page with TWO buttons:
--     - "Explore the old version →" to /research/invisible-punctum
--     - "Explore new version (Gamified) →" to /research/invisible-punctum-game)
-- 
-- 4. llm-chatbot → /research/llm-chatbot
--    (Explanation page with "Launch the experiment →" button to /llm-testing)
-- 
-- 5. do-ghosts-feel-jealous → /research/do-ghosts-feel-jealous
--    (Explanation page with "Go through the body of work →" button to www.whydidyoucry.com)
-- 
-- Hidden experiments (not shown in research gallery, only accessible via launch buttons):
-- - /research/obsidian-vault (Obsidian vault experiment)
-- - /research/invisible-punctum (Old version of Invisible Punctum)
-- - /research/invisible-punctum-game (Gamified version of Invisible Punctum)
-- - /llm-testing (LLM chatbot experiment)
-- - www.whydidyoucry.com (External case study)
-- ============================================
