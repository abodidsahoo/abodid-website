# Automated Test User Creation

## Quick Start

Run this command to create all 3 test users automatically:

```bash
node scripts/create-test-users.js
```

This will create:
- `alex@test.com` / `test123` (username: alexchen)
- `sam@test.com` / `test123` (username: samrivera)  
- `jordan@test.com` / `test123` (username: jordanlee)

---

## Setup (One-Time)

### 1. Get Your Service Role Key

1. Go to **Supabase Dashboard** → **Project Settings** → **API**
2. Find **Project API keys** section
3. Copy the `service_role` key (⚠️ keep this secret!)

### 2. Add to Environment Variables

Add to your `.env` file:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Security Note:** The `.env` file is already in `.gitignore` - never commit this key!

---

## What It Does

The script automatically:
1. ✅ Creates auth users in Supabase Auth
2. ✅ Auto-confirms their emails (no verification needed)
3. ✅ Creates profiles with usernames, bios, and avatars
4. ✅ Handles duplicates gracefully (skips if user exists)

---

## Running the Script

```bash
# From project root
node scripts/create-test-users.js
```

**Expected output:**
```
🚀 Starting test user creation...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Creating user: alex@test.com...
✅ Auth user created with ID: abc123...
✅ Profile created for alexchen
   📧 Email: alex@test.com
   🔑 Password: test123
   👤 Username: alexchen
   🔗 Profile: /resources/u/alexchen

[...continues for other users...]

📊 Summary:
   ✅ Created: 3
   ⚠️  Skipped (already exist): 0
   ❌ Failed: 0

🎉 Test users are ready!
```

---

## Troubleshooting

**Error: Missing environment variables**
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is in your `.env` file
- Check that `.env` is in the project root

**Error: User already exists**
- The script will skip existing users (this is normal)
- To recreate them, delete from Supabase Auth Dashboard first

**Error: Profile creation failed**
- Check that the `profiles` table exists and RLS policies allow inserts
- Verify the schema matches (username, full_name, avatar_url, bio, website, role)
