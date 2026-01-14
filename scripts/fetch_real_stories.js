
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jwipqbjxpmgyevfzpjjx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXBxYmp4cG1neWV2Znpwamp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxOTEyMTUsImV4cCI6MjA4Mzc2NzIxNX0.eG3p3TnYZWrSukGmhWcWk9OSLdmAIIsDiIme3Or-F5o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchStories() {
    const { data, error } = await supabase
        .from('posts')
        .select('title, slug, content');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('REAL STORIES FROM DB:');
        console.log(JSON.stringify(data, null, 2));
    }
}

fetchStories();
