# Enable Anonymous Authentication in Supabase

## Step 1: Enable Anonymous Auth

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Authentication** → **Providers**  
4. Scroll down to **Anonymous**
5. **Toggle ON**: "Enable anonymous sign-ins"
6. Click **Save**

✅ Done! Anonymous auth is now enabled.

---

## Step 2: Apply RLS Policy Updates

Run the SQL migration to allow anonymous users to bookmark/upvote:

1. Go to **SQL Editor** in Supabase Dashboard
2. Open [`anonymous_auth_rls.sql`](file:///Users/abodid/Documents/GitHub/personal-site/anonymous_auth_rls.sql)
3. Copy all the SQL
4. Paste into SQL Editor
5. Click **Run**

This updates the RLS policies to allow `auth.uid()` which works for both anonymous and authenticated users.

---

## Step 3: Test the Flow

### Test Anonymous Bookmarking:
1. Open your site in **incognito/private mode**
2. Click 🔖 Save on any resource
3. It should succeed instantly (no login prompt!)
4. Check browser console - should see "Creating anonymous session..."
5. Bookmark 1-2 more resources
6. On the 3rd bookmark, sync popup should appear!

### Test Popup:
1. **Click "Create Account"** → Should redirect to `/login?mode=signup&link=true`
2. Sign up with email
3. After signup, your anonymous bookmarks should still be there!

### Test "Not Now":
1. Click "Not Now" on popup
2. Continue bookmarking
3. Popup won't show again until next milestone (10th bookmark)

---

## Verification Checklist

- [ ] Anonymous auth enabled in Supabase
- [ ] RLS policies updated (run SQL)
- [ ] Test bookmark without login (should work)
- [ ] Test popup shows at 1st, 3rd bookmark
- [ ] Test "Create Account" flow
- [ ] Test "Not Now" - continue bookmarking
- [ ] Test signup preserves anonymous bookmarks

---

## Troubleshooting

**Popup not showing:**
- Check browser console for errors
- Clear localStorage: `localStorage.clear()`
- Reload and try again

**Bookmarks not saving:**
- Check RLS policies are applied
- Verify anonymous auth is enabled
- Check browser console for Supabase errors

**Data not preserved after signup:**
- Check that account creation completes
- Look for migration errors in console
- Manually verify in Supabase table editor

---

**Next:** Once tested, this will be the default experience for all new users! 🎉
