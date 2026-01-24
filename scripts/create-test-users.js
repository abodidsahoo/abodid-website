/**
 * Automated Test User Creation Script
 * 
 * This script uses the Supabase Admin API to create test users
 * with their profiles automatically.
 * 
 * Usage: node scripts/create-test-users.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing environment variables');
    console.error('Make sure PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Test users configuration - Super simple for easy testing
const testUsers = [
    {
        email: 'test1@gmail.com',
        password: 'test123',
        username: 'test1',
        full_name: 'Test User 1',
        avatar_url: 'https://i.pravatar.cc/150?img=10',
        bio: 'Test user account for development and testing.',
        website: null
    },
    {
        email: 'test2@gmail.com',
        password: 'test123',
        username: 'test2',
        full_name: 'Test User 2',
        avatar_url: 'https://i.pravatar.cc/150?img=20',
        bio: 'Test user account for development and testing.',
        website: null
    },
    {
        email: 'test3@gmail.com',
        password: 'test123',
        username: 'test3',
        full_name: 'Test User 3',
        avatar_url: 'https://i.pravatar.cc/150?img=30',
        bio: 'Test user account for development and testing.',
        website: null
    }
];

async function createTestUser(userData) {
    const { email, password, username, full_name, avatar_url, bio, website } = userData;

    console.log(`\n🔄 Creating user: ${email}...`);

    try {
        // Step 1: Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: full_name
            }
        });

        if (authError) {
            // Check if user already exists
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                console.log(`⚠️  User ${email} already exists, skipping creation...`);
                console.log(`   You can log in with: ${email} / ${password}`);
                return { success: false, reason: 'exists' };
            }
            throw authError;
        }

        const userId = authData.user.id;
        console.log(`✅ Auth user created with ID: ${userId}`);

        // Step 2: Upsert profile (insert or update if exists)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                username: username,
                full_name: full_name,
                avatar_url: avatar_url,
                bio: bio,
                website: website,
                role: 'user',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });

        if (profileError) {
            console.error(`❌ Error creating/updating profile for ${email}:`, profileError.message);
            console.error(`   Profile error details:`, profileError);
            return { success: false, reason: 'profile_error', error: profileError };
        }

        console.log(`✅ Profile created for ${username}`);
        console.log(`   📧 Email: ${email}`);
        console.log(`   🔑 Password: ${password}`);
        console.log(`   👤 Username: ${username}`);
        console.log(`   🔗 Profile: /resources/u/${username}`);

        return { success: true, userId, username };

    } catch (error) {
        console.error(`❌ Error creating ${email}:`, error.message);
        return { success: false, reason: 'error', error };
    }
}

async function main() {
    console.log('🚀 Starting test user creation...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const results = {
        created: 0,
        skipped: 0,
        failed: 0
    };

    // Create all test users
    for (const userData of testUsers) {
        const result = await createTestUser(userData);

        if (result.success) {
            results.created++;
        } else if (result.reason === 'exists') {
            results.skipped++;
        } else {
            results.failed++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${results.created}`);
    console.log(`   ⚠️  Skipped (already exist): ${results.skipped}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    if (results.created > 0 || results.skipped > 0) {
        console.log('\n🎉 Test users are ready!');
        console.log('\n📝 Login credentials:');
        testUsers.forEach(user => {
            console.log(`   • ${user.email} / ${user.password}`);
        });
        console.log('\n🔗 Profile URLs:');
        testUsers.forEach(user => {
            console.log(`   • /resources/u/${user.username}`);
        });
    }

    console.log('\n✨ Done!\n');
}

// Run the script
main().catch(console.error);
