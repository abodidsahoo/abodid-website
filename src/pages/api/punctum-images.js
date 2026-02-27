import { listPhotoStoryAssets } from '../../lib/services/photoStories';

export const prerender = false;

export async function GET() {
    try {
        // Pull ALL photo story assets (covers + gallery images)
        const assets = await listPhotoStoryAssets();
        const formattedImages = (assets || []).map(asset => ({
            id: asset.photoUrl,
            url: asset.photoUrl,
            title: asset.projectTitle,
            source: asset.sourceType
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
