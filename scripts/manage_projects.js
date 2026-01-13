
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
// Priority: Service Role Key > Anon Key (Using Service Role Key allows updates bypassing RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listProjects() {
    const { data, error } = await supabase
        .from('research')
        .select('id, slug, title, tags, link, sort_order, published')
        .order('sort_order', { ascending: true });

    if (error) {
        console.error("Error fetching projects:", error.message);
        return;
    }

    console.log("\n--- Research Projects ---\n");
    data.forEach(p => {
        console.log(`[${p.slug}] ${p.title}`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Tags: ${p.tags ? p.tags.join(', ') : 'None'}`);
        console.log(`   Link: ${p.link || 'Internal/None'}`);
        console.log(`   Order: ${p.sort_order} | Published: ${p.published}`);
        console.log('-------------------------');
    });
}

async function updateProject(slug, updates) {
    console.log(`Updating '${slug}' with:`, updates);

    const { data, error } = await supabase
        .from('research')
        .update(updates)
        .eq('slug', slug)
        .select();

    if (error) {
        console.error("Error updating project:", error.message);
    } else if (data.length === 0) {
        console.error(`Project '${slug}' not found.`);
    } else {
        console.log("Success! Updated project:", data[0].title);
        console.log("New Tags:", data[0].tags);
        console.log("New Link:", data[0].link);
    }
}

// CLI Argument Parsing
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    switch (command) {
        case 'list':
            await listProjects();
            break;
        case 'update':
            // Usage: node scripts/manage_projects.js update [slug] --tags "A,B" --link "http..."
            const slug = args[1];
            if (!slug) {
                console.error("Please provide a slug: update <slug>");
                process.exit(1);
            }

            const updates = {};
            for (let i = 2; i < args.length; i++) {
                if (args[i] === '--tags') {
                    updates.tags = args[i + 1].split(',').map(s => s.trim());
                    i++;
                } else if (args[i] === '--link') {
                    updates.link = args[i + 1];
                    i++;
                } else if (args[i] === '--title') {
                    updates.title = args[i + 1];
                    i++;
                } else if (args[i] === '--desc') {
                    updates.description = args[i + 1];
                    i++;
                }
            }

            if (Object.keys(updates).length === 0) {
                console.log("No updates provided. Use --tags, --link, --title, or --desc");
                return;
            }

            await updateProject(slug, updates);
            break;
        default:
            console.log("Usage:");
            console.log("  node scripts/manage_projects.js list");
            console.log("  node scripts/manage_projects.js update <slug> --tags \"Tag1, Tag2\" --link \"https://...\"");
    }
}

main();
