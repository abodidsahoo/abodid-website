
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
// Use Service Role Key if available to bypass RLS, otherwise fallback to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log("Migrating 'Obsidian Vault' to Supabase...");

    // Defines the vault object
    const vaultProject = {
        title: "Obsidian Vault",
        slug: "obsidian-vault",
        description: "A digital garden of raw thoughts, research, and connections.",
        tags: ["Second Brain", "Knowledge Management", "Obsidian"],
        published: true,
        sort_order: -1, // Ensure it comes first
        link: null, // It's internal, handled by slug routing in frontend
    };

    // Check if it already exists to avoid duplicates
    const { data: existing } = await supabase
        .from('research')
        .select('id')
        .eq('slug', 'obsidian-vault')
        .maybeSingle();

    if (existing) {
        console.log("Record already exists. Updating tags/description just in case...");
        const { error } = await supabase
            .from('research')
            .update(vaultProject)
            .eq('id', existing.id);

        if (error) console.error("Update failed:", error);
        else console.log("Update successful.");
    } else {
        console.log("Creating new record...");
        const { error } = await supabase
            .from('research')
            .insert([vaultProject]);

        if (error) console.error("Insert failed:", error);
        else console.log("Insert successful.");
    }
}

migrate();
