import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function createBucketIfNotExists(bucketName, isPublic = true) {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error(`Error listing buckets: ${listError.message}`);
        return;
    }

    const exists = buckets.find(b => b.name === bucketName);
    if (exists) {
        console.log(`Bucket '${bucketName}' already exists.`);
    } else {
        const { data, error } = await supabase.storage.createBucket(bucketName, {
            public: isPublic,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
        });
        if (error) {
            console.error(`Error creating bucket '${bucketName}': ${error.message}`);
        } else {
            console.log(`Bucket '${bucketName}' created successfully.`);
        }
    }
}

async function main() {
    console.log('--- Initializing Supabase Storage ---');

    // Create buckets needed for the CMS
    await createBucketIfNotExists('photography');
    await createBucketIfNotExists('films');
    await createBucketIfNotExists('blog');
    await createBucketIfNotExists('research');
    await createBucketIfNotExists('page-assets'); // For miscellaneous page metadata images

    console.log('\n--- Database Tables ---');
    console.log('NOTE: The supabase-js client cannot create tables directly.');
    console.log('Please copy the following SQL and run it in your Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/_/sql/new');
    console.log('\n-------------------------------------------------------------');

    try {
        const sqlPath = path.join(process.cwd(), 'create_page_metadata_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log(sqlContent);
    } catch (e) {
        console.error('Could not read create_page_metadata_table.sql', e);
    }
    console.log('-------------------------------------------------------------\n');
}

main();
