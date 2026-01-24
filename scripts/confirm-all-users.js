/**
 * Manually Confirm All Unconfirmed Users
 * Use this if email confirmation is broken
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('\n🔧 Manually Confirming All Users...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const confirmAllUsers = async () => {
    try {
        // Get all users
        const { data: { users }, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('❌ Error fetching users:', error.message);
            return;
        }

        // Filter unconfirmed users
        const unconfirmed = users.filter(u => !u.email_confirmed_at);

        if (unconfirmed.length === 0) {
            console.log('✅ All users are already confirmed! Nothing to do.\n');
            return;
        }

        console.log(`Found ${unconfirmed.length} unconfirmed user(s). Confirming...\n`);

        let successCount = 0;
        let failCount = 0;

        for (const user of unconfirmed) {
            try {
                // Update user to mark as confirmed
                const { error: updateError } = await supabase.auth.admin.updateUserById(
                    user.id,
                    { email_confirm: true }
                );

                if (updateError) {
                    console.log(`❌ Failed to confirm ${user.email}: ${updateError.message}`);
                    failCount++;
                } else {
                    console.log(`✅ Confirmed: ${user.email}`);
                    successCount++;
                }
            } catch (err) {
                console.log(`❌ Error with ${user.email}: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📊 Summary:');
        console.log(`   ✅ Confirmed: ${successCount}`);
        console.log(`   ❌ Failed: ${failCount}`);
        console.log('\n🎉 Users can now log in without email confirmation!\n');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
};

await confirmAllUsers();
