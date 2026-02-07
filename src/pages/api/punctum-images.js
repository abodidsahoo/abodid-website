// Initialize Supabase Client (Server-Side)
import { supabase } from '../../lib/supabase';

export const prerender = false;

export async function GET() {
    try {
        // Logic: Fetch images for the game.
        // Fetch images directly from the main 'photography' table
        // This is the "Clean Supabase Content" source.
        let { data: images, error } = await supabase
            .from('photography')
            .select('cover_image, title, id')
            .not('cover_image', 'is', null);

        if (error) throw error;

        // Normalize to expected format
        const formattedImages = images.map(img => ({
            id: img.id,
            url: img.cover_image, // Frontend expects 'url'
            title: img.title
        }));

        return new Response(JSON.stringify(formattedImages), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
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
