import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const testEmails = ['alex@test.com', 'sam@test.com', 'jordan@test.com'];

console.log('\n🔍 Checking test users...\n');

for (const email of testEmails) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (user) {
        console.log(`✅ ${email}`);
        console.log(`   ID: ${user.id}`);
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (profile) {
            console.log(`   Profile: @${profile.username || 'NO USERNAME'}`);
        } else {
            console.log(`   Profile: ❌ MISSING`);
        }
    } else {
        console.log(`❌ ${email} - Not found`);
    }
    console.log('');
}
