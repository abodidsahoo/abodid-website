# User Data Storage Guide

## 📊 Where User Data is Stored

All user data is stored in your Supabase PostgreSQL database. Here's the complete breakdown:

---

## Database Tables Overview

### 1. **`profiles`** - User Account Information
**Location:** `public.profiles`

**What's stored:**
- User ID (linked to `auth.users`)
- Username (e.g., "test1", "alexchen")
- Full name
- Avatar URL
- Bio
- Website
- Social links (JSON)
- **Role** (user/curator/admin)

**Example row:**
```sql
id: "abc-123-uuid"
username: "test1"
full_name: "Test User 1"
role: "curator"
avatar_url: "https://..."
```

**View your data:**
```sql
SELECT * FROM profiles WHERE username = 'test1';
```

---

### 2. **`hub_resource_bookmarks`** - Saved Resources
**Location:** `public.hub_resource_bookmarks`

**What's stored:**
- User ID (who bookmarked)
- Resource ID (what they bookmarked)
- Created at (when they saved it)

**Example row:**
```sql
user_id: "abc-123-uuid"
resource_id: "xyz-456-uuid"
created_at: "2026-01-24T15:30:00Z"
```

**View a user's bookmarks:**
```sql
SELECT r.* 
FROM hub_resources r
JOIN hub_resource_bookmarks b ON b.resource_id = r.id
WHERE b.user_id = 'USER_ID_HERE';
```

**This powers:**
- `/resources/saved` page
- Saved Collection tab on profiles
- 🔖 Save button state

---

### 3. **`hub_resource_upvotes`** - Upvoted Resources
**Location:** `public.hub_resource_upvotes`

**What's stored:**
- User ID (who upvoted)
- Resource ID (what they upvoted)
- Created at (when they upvoted)

**Example row:**
```sql
user_id: "abc-123-uuid"
resource_id: "xyz-456-uuid"
created_at: "2026-01-24T16:00:00Z"
```

**View a user's upvotes:**
```sql
SELECT r.* 
FROM hub_resources r
JOIN hub_resource_upvotes u ON u.resource_id = r.id
WHERE u.user_id = 'USER_ID_HERE';
```

**This powers:**
- 👍 Upvote button state
- Upvote counts in header stats
- Sorting by "Top"

---

### 4. **`hub_resources`** - Submitted Resources
**Location:** `public.hub_resources`

**What's stored:**
- Resource ID
- Title, description, URL
- Thumbnail URL
- **`submitted_by`** (user ID who created it)
- Status (pending/approved/rejected)
- Upvotes count (denormalized)
- Created/updated timestamps

**Example row:**
```sql
id: "xyz-456-uuid"
title: "Amazing Design Tool"
submitted_by: "abc-123-uuid"  ← Links to user
status: "approved"
upvotes_count: 23
```

**View a user's submissions:**
```sql
SELECT * FROM hub_resources 
WHERE submitted_by = 'USER_ID_HERE';
```

**This powers:**
- "Submitted Gems" tab on profiles
- Submission history
- Credit to curators

---

## 🔍 Complete User Data Query

To see **everything** a user has done:

```sql
-- Get user profile
SELECT * FROM profiles WHERE id = 'USER_ID';

-- Get their bookmarks
SELECT r.title, b.created_at 
FROM hub_resource_bookmarks b
JOIN hub_resources r ON r.id = b.resource_id
WHERE b.user_id = 'USER_ID'
ORDER BY b.created_at DESC;

-- Get their upvotes
SELECT r.title, u.created_at 
FROM hub_resource_upvotes u
JOIN hub_resources r ON r.id = u.resource_id
WHERE u.user_id = 'USER_ID'
ORDER BY u.created_at DESC;

-- Get their submissions
SELECT title, status, upvotes_count, created_at
FROM hub_resources
WHERE submitted_by = 'USER_ID'
ORDER BY created_at DESC;
```

---

## 🗑️ Data Cleanup on User Deletion

When you delete a user via the admin panel, this happens automatically:

1. **Auth account deleted** (`auth.users`)
2. **Profile deleted** (`profiles`) - via foreign key cascade
3. **Bookmarks deleted** (`hub_resource_bookmarks`) - via foreign key cascade
4. **Upvotes deleted** (`hub_resource_upvotes`) - via foreign key cascade
5. **Submitted resources** stay in the database but `submitted_by` becomes NULL

This is why delete actions have a strong warning!

---

## 📍 Where to View This Data

### In Supabase Dashboard:
1. Go to **Table Editor**
2. Select the table you want to view:
   - `profiles` - user accounts
   - `hub_resource_bookmarks` - saved items
   - `hub_resource_upvotes` - upvotes
   - `hub_resources` - all resources

### In Your App:
1. **User Dashboard** - `/resources/saved` shows bookmarks
2. **Profile Pages** - `/resources/u/[username]` shows submissions and saves
3. **Header Stats** - Shows upvote count and bookmark count
4. **Admin Panel** - `/resources/admin/users` shows all users

---

## 🔐 Data Privacy

- **Bookmarks**: Private by default, visible on profile if you make them public
- **Upvotes**: Counts are public, individual upvoters are tracked but not shown
- **Submissions**: Public with curator attribution
- **Profile**: Public (username, bio, avatar, website)

---

## 💾 Backup Your Data

To export all user data:

```bash
# Export as SQL dump
pg_dump your_database_url > backup.sql

# Or use Supabase dashboard:
# Project Settings → Database → Backups
```

---

## Summary

| Data Type | Table | User Can See It At |
|-----------|-------|--------------------|
| Profile | `profiles` | `/resources/u/[username]` |
| Bookmarks | `hub_resource_bookmarks` | `/resources/saved` |
| Upvotes | `hub_resource_upvotes` | Header stats |
| Submissions | `hub_resources` | Profile > Submitted Gems |

All data is stored securely in Supabase PostgreSQL with proper foreign key constraints and RLS policies!
