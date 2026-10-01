export const prerender = false;

import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";

const mediaColumns = [
    "id",
    "original_filename",
    "object_key",
    "public_url",
    "folder_path",
    "mime_type",
    "width",
    "height",
    "alt_text",
    "caption",
    "created_at",
    "origin_project_id",
    "media_variants(variant_key,public_url,actual_width,actual_height,mime_type,file_size)",
].join(",");

const photographyScore = (asset: any) => {
    const haystack = `${asset.folder_path || ""} ${asset.original_filename || ""}`.toLowerCase();
    if (/photograph|portrait|street|travel|fashion|editorial|photo/.test(haystack)) return 4;
    if (asset.origin_project_id) return 2;
    if (/portfolio/.test(haystack)) return 1;
    return 0;
};

export const GET: APIRoute = async ({ request, url }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const query = (url.searchParams.get("q") || "").trim();
    const random = url.searchParams.get("random") === "1";
    if (query.length > 100) return jsonResponse({ error: "Search is too long." }, 400);

    let mediaQuery = authorization.supabase
        .from("media_assets")
        .select(mediaColumns)
        .in("mime_type", ["image/jpeg", "image/jpg"])
        .order("created_at", { ascending: false })
        .limit(query ? 500 : 1000);

    if (query) mediaQuery = mediaQuery.ilike("original_filename", `%${query}%`);

    const { data, error } = await mediaQuery;
    if (error) {
        console.error("Could not load Instagram media choices:", error);
        return jsonResponse({ error: "Could not load photographs from the Media Library." }, 500);
    }

    const sorted = [...(data || [])].sort((left: any, right: any) => {
            const priority = photographyScore(right) - photographyScore(left);
            if (priority) return priority;
            return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        });
    if (random) {
        for (let index = sorted.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
        }
    }
    const items = sorted
        .slice(0, 240)
        .map((asset: any) => {
            const variants = Array.isArray(asset.media_variants) ? asset.media_variants : [];
            const variant1600 = variants.find((item: any) => item.variant_key === "1600");
            const variant800 = variants.find((item: any) => item.variant_key === "800");
            return {
                id: asset.id,
                name: asset.original_filename,
                folder: asset.folder_path,
                objectKey: asset.object_key,
                publicUrl: asset.public_url,
                mimeType: asset.mime_type,
                url: variant1600?.public_url || asset.public_url,
                thumbnailUrl: variant800?.public_url || variant1600?.public_url || asset.public_url,
                width: variant1600?.actual_width || asset.width,
                height: variant1600?.actual_height || asset.height,
                altText: asset.alt_text || asset.caption || asset.original_filename,
                isPhotography: photographyScore(asset) > 0,
                catalogued: true,
                variants: Object.fromEntries(variants.map((variant: any) => [variant.variant_key, {
                    key: variant.variant_key,
                    url: variant.public_url,
                    width: variant.actual_width,
                    height: variant.actual_height,
                    mimeType: variant.mime_type,
                    fileSize: variant.file_size,
                }])),
            };
        });

    return jsonResponse({ items, query, truncated: (data || []).length >= (query ? 500 : 1000) });
};
