-- Simple Test Users for Resources Hub Testing
-- Run this in Supabase SQL Editor to create test users

-- IMPORTANT: These users are created manually in the profiles table.
-- To actually log in with these accounts, you need to create them in Supabase Auth Dashboard:
-- Go to: Authentication > Users > Add User
-- Use the emails and passwords below

-- Step 1: Create usernames and basic profiles
-- (The user IDs are randomly generated UUIDs - replace with actual UUIDs from Auth after creating users)

-- Test User 1: Alex Chen
-- Email: alex@test.com
-- Password: test123
-- After creating in Auth Dashboard, get the user_id and run:
-- INSERT INTO profiles (id, username, full_name, avatar_url, role)
-- VALUES ('USER_ID_HERE', 'alexchen', 'Alex Chen', 'https://i.pravatar.cc/150?img=12', 'user');

-- Test User 2: Sam Rivera  
-- Email: sam@test.com
-- Password: test123
-- After creating in Auth Dashboard, get the user_id and run:
-- INSERT INTO profiles (id, username, full_name, avatar_url, role)
-- VALUES ('USER_ID_HERE', 'samrivera', 'Sam Rivera', 'https://i.pravatar.cc/150?img=33', 'user');

-- Test User 3: Jordan Lee
-- Email: jordan@test.com
-- Password: test123
-- After creating in Auth Dashboard, get the user_id and run:
-- INSERT INTO profiles (id, username, full_name, avatar_url, role)
-- VALUES ('USER_ID_HERE', 'jordanlee', 'Jordan Lee', 'https://i.pravatar.cc/150?img=47', 'user');


-- ========================================
-- QUICK SETUP INSTRUCTIONS:
-- ========================================
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" for each test user:
--    - alex@test.com (password: test123)
--    - sam@test.com (password: test123)  
--    - jordan@test.com (password: test123)
-- 3. After creating each user, copy their UUID from the dashboard
-- 4. Run the INSERT statements below, replacing 'USER_ID_HERE' with actual UUIDs


-- ========================================
-- PROFILE INSERTS (replace USER_ID_HERE):
-- ========================================

-- Alex Chen
INSERT INTO profiles (id, username, full_name, avatar_url, bio, website, role)
VALUES (
    'USER_ID_ALEX',
    'alexchen',
    'Alex Chen',
    'https://i.pravatar.cc/150?img=12',
    'Designer and creative technologist exploring the intersection of art and code.',
    'https://alexchen.design',
    'user'
);

-- Sam Rivera
INSERT INTO profiles (id, username, full_name, avatar_url, bio, website, role)
VALUES (
    'USER_ID_SAM',
    'samrivera',
    'Sam Rivera',
    'https://i.pravatar.cc/150?img=33',
    'Filmmaker and visual storyteller. Love discovering tools that enhance creativity.',
    'https://samrivera.film',
    'user'
);

-- Jordan Lee
INSERT INTO profiles (id, username, full_name, avatar_url, bio, website, role)
VALUES (
    'USER_ID_JORDAN',
    'jordanlee',
    'Jordan Lee',
    'https://i.pravatar.cc/150?img=47',
    'UX researcher passionate about accessible design and human-centered tools.',
    'https://jordanlee.io',
    'user'
);


-- ========================================
-- SUMMARY:
-- ========================================
-- Email/Password combinations:
-- alex@test.com / test123
-- sam@test.com / test123
-- jordan@test.com / test123
--
-- Usernames:
-- alexchen, samrivera, jordanlee
