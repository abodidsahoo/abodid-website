# Public User Registration & Curator System Guide

## 🎯 Current Status

✅ **You ALREADY have public signup enabled!** 
- Login/Signup page: `/login`
- Users can create accounts and log in
- All new users start as regular "user" role

---

## 📝 How People Can Sign Up

### For Regular Users:

1. **Go to** `/login` on your website
2. **Click** "Sign Up" toggle at the bottom
3. **Fill in:**
   - Full Name
   - Email address
   - Password (minimum 6 characters)
4. **Click** "Create Account"
5. **Check email** for confirmation link (Supabase sends this automatically)
6. **Click confirmation link** to activate account
7. **Return to** `/login` and log in

Once logged in, they can:
- ✅ Bookmark resources
- ✅ Upvote resources  
- ✅ Submit new resources
- ✅ View their profile at `/resources/u/[username]`

---

## 👥 User Roles Explained

### 1. **User** (Default)
- Can bookmark, upvote, and submit resources
- All new signups get this role
- Resources they submit need approval

### 2. **Curator** 
- Same as User, plus resources bypass approval queue
- Must be manually upgraded by admin

### 3. **Admin**
- Full access to approve/reject resources
- Can manage all content
- Must be manually assigned

---

## 🔧 How to Make Someone a Curator

Since there's no admin panel yet, you need to update the database directly:

### Option 1: Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → **Table Editor** → **profiles**
2. Find the user by their email/username
3. Click on their row
4. Change `role` from `user` to `curator`
5. Save

### Option 2: SQL Query

```sql
-- Update a specific user to curator
UPDATE profiles 
SET role = 'curator'
WHERE username = 'their_username';

-- Or by email (need to join with auth.users)
UPDATE profiles
SET role = 'curator'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'their@email.com'
);
```

---

## 📊 Supabase Limits (Free Tier)

Your current plan has these limits:

| Limit | Free Tier | Notes |
|-------|-----------|-------|
| **Monthly Active Users** | 50,000 | Users who log in per month |
| **Database Size** | 500 MB | Total storage for all tables |
| **Edge Function Invocations** | 500,000/month | API calls |
| **Storage** | 1 GB | File storage (if using) |
| **Bandwidth** | 5 GB | Data transfer per month |
| **Email Rate Limit** | 4 emails/hour | Confirmation/reset emails |

**For your use case:** The free tier is MORE than enough for a Resources Hub. The 50,000 monthly active users limit is very generous.

**Email Confirmation Issue:** The 4 emails/hour limit might be why signup seems slow - Supabase rate-limits confirmation emails to prevent spam.

---

## 🔍 Troubleshooting Signup Issues

### Problem: "Signup not working properly"

**Possible causes:**

1. **Email confirmation required**
   - By default, Supabase requires email confirmation
   - Users must click the link in their email
   - Solution: Check Supabase **Authentication** → **Email Templates**

2. **Email rate limiting**
   - Free tier: 4 emails/hour
   - If testing repeatedly, emails may be delayed
   - Solution: Wait or disable email confirmation for testing

3. **Profile not created**
   - After signup, a profile should auto-create
   - Check if you have a database trigger for this
   - Current behavior: Profiles must be created manually

---

## 🛠️ Recommended Fix: Auto-Create Profiles

Currently, when someone signs up, they get an auth account but NO profile. This means they can't use the resources features.

**Solution: Add a database trigger**

Run this SQL in Supabase:

```sql
-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    -- Generate username from email (before @)
    SPLIT_PART(NEW.email, '@', 1),
    -- Get full name from metadata
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

This will automatically create a profile whenever someone signs up!

---

## ✅ Quick Checklist

To enable smooth public signups:

- [ ] Run the auto-profile trigger SQL above
- [ ] Test signup at `/login` in incognito mode
- [ ] Check email for confirmation link
- [ ] Confirm account and log in
- [ ] Verify you can bookmark/upvote/submit
- [ ] Manually promote trusted users to `curator` role as needed

---

## 🎓 Summary

**For users to sign up:**
1. They visit `/login`
2. Click "Sign Up"
3. Fill the form
4. Confirm email
5. Log in and start curating!

**To make someone a curator:**
- Update their `role` in the `profiles` table to `'curator'`

**Supabase limits:**
- Free tier is more than enough (50k users/month)
- Only concern: 4 emails/hour for confirmations

**Best practice:**
- Add the auto-profile trigger to streamline new user experience
