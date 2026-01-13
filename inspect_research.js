
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase
        .from('research')
        .select('*')
        .ilike('title', '%Invisible Punctum%'); // Loose match to be sure

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found Projects:", data);
}

inspect();
