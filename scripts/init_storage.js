
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing Supabase URL or Service Role Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function initStorage() {
    const bucketName = 'newsletter-assets';

    console.log(`Checking bucket: ${bucketName}...`);

    // 1. Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError);
        return;
    }

    const exists = buckets.find(b => b.name === bucketName);

    if (exists) {
        console.log(`✅ Bucket '${bucketName}' already exists.`);
    } else {
        console.log(`Creating bucket '${bucketName}'...`);
        const { data, error } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        });

        if (error) {
            console.error('❌ Failed to create bucket:', error);
            // Fallback: Use SQL if API fails (API sometimes restricted depending on project settings)
        } else {
            console.log(`✅ Bucket '${bucketName}' created successfully.`);
        }
    }

    // 2. We can't easily create RLS policies via JS Client (requires SQL).
    // But for public buckets initialized with public: true, reading is open.
    // Writing usually requires a policy. 
    // Since we are using the ImageUploader component client-side (likely interacting with Supabase Storage API),
    // it usually uploads as an authenticated user.
    // We need to ensure there is an insert policy for authenticated users.

    console.log('\nNOTE: Storage buckets created via API might still need RLS policies for CLIENT-SIDE uploads.');
    console.log('If upload still fails, please run the following SQL in your Dashboard:');
    console.log(`
    -- Allow public read
    create policy "Public Access" on storage.objects for select using ( bucket_id = '${bucketName}' );
    
    -- Allow authenticated upload
    create policy "Authenticated Upload" on storage.objects for insert with check ( bucket_id = '${bucketName}' and auth.role() = 'authenticated' );
    `);
}

initStorage();
