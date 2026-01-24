# Quick Test Users Setup Guide

## 🎯 Three Simple Test Accounts

All test accounts use the password: **`test123`**

| Name | Email | Username | Password |
|------|-------|----------|----------|
| Alex Chen | `alex@test.com` | alexchen | test123 |
| Sam Rivera | `sam@test.com` | samrivera | test123 |
| Jordan Lee | `jordan@test.com` | jordanlee | test123 |

---

## 📝 Setup Steps

### Step 1: Create Users in Supabase Auth

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add User"** (or "Invite")
3. For each test user, enter:
   - **Email**: (use emails from table above)
   - **Password**: `test123`
   - **Auto Confirm User**: ✅ (check this box!)
4. Click **Create User**
5. **Copy the User ID** (UUID) that appears after creation

Repeat for all three test users.

---

### Step 2: Add Profiles to Database

After creating all three users in Auth, go to **SQL Editor** and run this:

```sql
-- Replace USER_ID_ALEX, USER_ID_SAM, USER_ID_JORDAN with actual UUIDs from Step 1

-- Alex Chen
INSERT INTO profiles (id, username, full_name, avatar_url, bio, website, role)
VALUES (
    'USER_ID_ALEX',  -- ← Replace this
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
    'USER_ID_SAM',  -- ← Replace this
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
    'USER_ID_JORDAN',  -- ← Replace this
    'jordanlee',
    'Jordan Lee',
    'https://i.pravatar.cc/150?img=47',
    'UX researcher passionate about accessible design and human-centered tools.',
    'https://jordanlee.io',
    'user'
);
```

---

## ✅ Testing Checklist

Once set up, test the following:

- [ ] Log in as each test user (email + `test123`)
- [ ] View "My Profile" (should show username, bio, website)
- [ ] Bookmark a resource (click 🔖 Save button)
- [ ] Check `/resources/saved` shows bookmarked items
- [ ] Upvote a resource (click 👍 button)
- [ ] Visit another test user's profile at `/resources/u/[username]`
- [ ] Submit a resource (tests rate limiting after 3)
- [ ] Try the honeypot by inspecting and filling the hidden field

---

## 🔑 Quick Reference

**Login Credentials:**
```
alex@test.com / test123
sam@test.com / test123
jordan@test.com / test123
```

**Profile URLs:**
```
/resources/u/alexchen
/resources/u/samrivera
/resources/u/jordanlee
```
