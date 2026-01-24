# Test Users Setup

## Quick Test User Credentials

Since Supabase Auth requires proper password hashing, you'll need to create these users through the **Supabase Dashboard**:

### Method 1: Supabase Dashboard (Recommended)
1. Go to **Authentication > Users** in your Supabase Dashboard
2. Click **Add User** and create each user manually:

**Test User 1:**
- Email: `test1@demo.com`
- Password: `pass123`
- Username: `test1`

**Test User 2:**
- Email: `test2@demo.com`
- Password: `pass123`
- Username: `test2`

**Test User 3:**
- Email: `test3@demo.com`
- Password: `pass123`
- Username: `test3`

### Method 2: SQL (After Creating via Dashboard)
Once users are created, run this SQL to add their profiles:

```sql
-- This assumes the users were created via Dashboard/Auth API
-- Replace the UUIDs with actual user IDs from auth.users table

INSERT INTO public.profiles (id, username, full_name, role)
VALUES
  -- Get the actual UUIDs from: SELECT id, email FROM auth.users WHERE email LIKE 'test%';
  ('USER_ID_1', 'test1', 'Test User One', 'user'),
  ('USER_ID_2', 'test2', 'Test User Two', 'user'),
  ('USER_ID_3', 'test3', 'Test User Three', 'user')
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
```

### Quick Login URLs
After creating:
- Login at: `http://localhost:4321/login`
- Use credentials above to test bookmarking and upvoting

## Testing Bookmarks & Upvotes

Once logged in as any test user, you can:
1. Browse to `/resources`
2. Click the bookmark icon to save items
3. Click upvote to vote
4. Visit `/resources/saved` to see your saved collection
