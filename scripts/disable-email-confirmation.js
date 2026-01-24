/**
 * Disable Email Confirmation Forever
 * 
 * This script:
 * 1. Confirms all currently unconfirmed users
 * 2. Provides instructions to disable email confirmation in Supabase
 * 
 * After running this, new signups won't need email confirmation!
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('\n🔧 Disabling Email Confirmation...\n');
console.log('═══════════════════════════════════════════════════════\n');

async function disableEmailConfirmation() {
    // Step 1: Confirm all existing unconfirmed users
    console.log('📋 Step 1: Confirming all existing unconfirmed users...\n');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('❌ Error fetching users:', error.message);
        return;
    }

    const unconfirmed = users.filter(u => !u.email_confirmed_at);

    if (unconfirmed.length === 0) {
        console.log('✅ All users are already confirmed!\n');
    } else {
        console.log(`Found ${unconfirmed.length} unconfirmed user(s). Confirming now...\n`);

        for (const user of unconfirmed) {
            try {
                const { error: updateError } = await supabase.auth.admin.updateUserById(
                    user.id,
                    { email_confirm: true }
                );

                if (updateError) {
                    console.log(`❌ Failed: ${user.email}`);
                } else {
                    console.log(`✅ Confirmed: ${user.email}`);
                }
            } catch (err) {
                console.log(`❌ Error: ${user.email}`);
            }
        }
        console.log('');
    }

    // Step 2: Instructions for Supabase Dashboard
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📋 Step 2: Disable Email Confirmation in Supabase\n');
    console.log('Unfortunately, email confirmation settings cannot be changed via API.');
    console.log('You must do this manually in the Supabase Dashboard:\n');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to: Authentication → Providers → Email');
    console.log('4. Scroll down to "Confirm email"');
    console.log('5. UNCHECK: "Enable email confirmations"');
    console.log('6. Click "Save"\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✨ After that, all future signups will work instantly!\n');
    console.log('Users can:\n');
    console.log('  ✓ Sign up at /login');
    console.log('  ✓ Log in immediately (no email needed)');
    console.log('  ✓ Start bookmarking, upvoting, and submitting\n');
}

await disableEmailConfirmation();
