import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client (Server-Side)
const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const prerender = false;

export async function GET() {
    try {
        // Logic: Fetch images for the game.
        // 1. Try fetching from the new dedicated project table first
        let { data, error } = await supabase
            .from('invisible_punctum_images')
            .select('image_url, id, title')
            .filter('active', 'eq', true)
            .limit(50);

        // 2. Fallback to 'photography' if new table is empty or missing (graceful degradation)
        if (error || !data || data.length === 0) {
            const fallback = await supabase
                .from('photography')
                .select('cover_image, id, title')
                .limit(50);

            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        // 3. Validate URLs and Normalize
        // Note: data might have 'image_url' (new table) or 'cover_image' (old table)
        const validImages = data
            .map(img => ({
                id: img.id,
                url: img.image_url || img.cover_image,
                title: img.title
            }))
            .filter(img => img.url && img.url.startsWith('http'));

        // 3. Return JSON
        return new Response(JSON.stringify(validImages), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" // Cache for 1 hour
            },
        });

    } catch (err) {
        console.error("API Error detailed:", err);
        return new Response(JSON.stringify({
            error: "Failed to fetch images",
            details: err.message,
            hint: "Check server logs for full stack trace"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
