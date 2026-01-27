import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    // Ideally Service Role for Delete, but mostly RLS allows delete if own data? 
    // Actually, for a cleanup script, we ideally need admin rights. 
    // If ANON key has DELETE allowed by policy (unlikely), it works.
    // If not, we might need the user to run SQL.
    // Let's try ANON first, but likely we need to just provide the SQL to the user.
    // Wait, I can try to run it. If it fails, I'll tell user.
);

export const prerender = false;

export async function GET() {
    try {
        // Delete rows where image_url contains 'website-files'
        const { count, error } = await supabase
            .from('photo_feedback')
            .delete({ count: 'exact' })
            .ilike('image_url', '%website-files%');

        if (error) throw error;

        return new Response(JSON.stringify({
            message: "Cleanup Executed",
            deleted_count: count
        }), { status: 200 });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
