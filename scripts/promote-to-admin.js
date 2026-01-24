#!/usr/bin/env node

/**
 * Script to promote a user to admin role
 * Usage: node scripts/promote-to-admin.js <email>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing environment variables');
    console.error('Make sure PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function promoteToAdmin(email) {
    if (!email) {
        console.error('❌ Error: Email is required');
        console.error('Usage: node scripts/promote-to-admin.js <email>');
        process.exit(1);
    }

    console.log(`\n🔍 Looking for user with email: ${email}...`);

    // Find user by email
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('❌ Error fetching users:', authError.message);
        process.exit(1);
    }

    const user = authData.users.find(u => u.email === email);

    if (!user) {
        console.error(`❌ Error: No user found with email: ${email}`);
        process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Check current role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('❌ Error fetching profile:', profileError.message);
        process.exit(1);
    }

    console.log(`📋 Current role: ${profile?.role || 'none'}`);

    if (profile?.role === 'admin') {
        console.log('ℹ️  User is already an admin. No changes made.');
        process.exit(0);
    }

    // Update role to admin
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            role: 'admin',
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (updateError) {
        console.error('❌ Error updating role:', updateError.message);
        process.exit(1);
    }

    console.log('✅ Successfully promoted user to admin!');
    console.log(`\n🎉 ${email} now has admin privileges.\n`);
}

// Get email from command line arguments
const email = process.argv[2];
promoteToAdmin(email);
