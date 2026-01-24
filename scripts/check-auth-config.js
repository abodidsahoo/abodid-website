/**
 * Check Supabase Auth Configuration
 * Run this to diagnose signup issues
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('\n🔍 Checking Supabase Auth Configuration...\n');

// Try to get auth settings from the admin API
const checkAuthSettings = async () => {
    try {
        // List recent users to see their confirmation status
        const { data: { users }, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('❌ Error fetching users:', error.message);
            return;
        }

        console.log(`📊 Total users in system: ${users.length}\n`);

        // Show last 5 users and their confirmation status
        const recentUsers = users.slice(-5);
        console.log('Recent users:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        recentUsers.forEach(user => {
            const confirmedStatus = user.email_confirmed_at ? '✅ CONFIRMED' : '❌ NOT CONFIRMED';
            console.log(`📧 ${user.email}`);
            console.log(`   Status: ${confirmedStatus}`);
            console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
            if (user.email_confirmed_at) {
                console.log(`   Confirmed: ${new Date(user.email_confirmed_at).toLocaleString()}`);
            }
            console.log('');
        });

        // Count unconfirmed users
        const unconfirmed = users.filter(u => !u.email_confirmed_at).length;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`⚠️  Unconfirmed users: ${unconfirmed}`);

        if (unconfirmed > 0) {
            console.log('\n💡 DIAGNOSIS:');
            console.log('   You have unconfirmed users. This means either:');
            console.log('   1. Email confirmation is ENABLED but emails aren\'t being sent');
            console.log('   2. Users haven\'t clicked their confirmation links yet');
            console.log('\n🔧 SOLUTION:');
            console.log('   Option A: Disable email confirmation in Supabase Dashboard');
            console.log('   Option B: Manually confirm users (see below)');
        } else {
            console.log('\n✅ All users are confirmed!');
            console.log('   Email confirmation might be disabled, or all users have confirmed.');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
};

await checkAuthSettings();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 MANUAL FIX OPTIONS:\n');
console.log('1️⃣  DISABLE EMAIL CONFIRMATION (easiest):');
console.log('   → Supabase Dashboard → Authentication → Providers → Email');
console.log('   → Uncheck "Confirm email" → Save\n');
console.log('2️⃣  MANUALLY CONFIRM USERS:');
console.log('   → Run: node scripts/confirm-all-users.js\n');
console.log('✨ Done!\n');
