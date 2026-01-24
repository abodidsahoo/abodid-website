import type { APIRoute } from 'astro';
import * as cheerio from 'cheerio';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Basic validation
        new URL(targetUrl); // throws if invalid

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ResourceHubBot/1.0; +http://abodid.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            '';

        const description =
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            '';

        const image =
            $('meta[property="og:image"]').attr('content') ||
            '';

        return new Response(JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            image: image.trim()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
