import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import { deleteR2Objects } from "../../../../lib/media/r2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const assetId = typeof body?.assetId === "string" && UUID_PATTERN.test(body.assetId)
            ? body.assetId
            : "";
        if (!assetId) return jsonResponse({ error: "A valid media asset is required." }, 400);

        const { data: asset, error: assetError } = await authorization.supabase
            .from("media_assets")
            .select("id,storage_provider,object_key,media_variants(object_key)")
            .eq("id", assetId)
            .maybeSingle();
        if (assetError) throw assetError;
        if (!asset) return jsonResponse({ deleted: false, reason: "missing" });

        const { count, error: usageError } = await authorization.supabase
            .from("portfolio_media_usages")
            .select("id", { count: "exact", head: true })
            .eq("asset_id", assetId);
        if (usageError) throw usageError;
        if (Number(count || 0) > 0) {
            return jsonResponse({
                deleted: false,
                reason: "referenced",
                referenceCount: Number(count || 0),
            }, 409);
        }

        if (asset.storage_provider !== "cloudflare_r2") {
            return jsonResponse({
                deleted: false,
                reason: "legacy",
                error: "Legacy media must be migrated before it can be removed here.",
            }, 409);
        }

        const objectKeys = [
            asset.object_key,
            ...((asset.media_variants || []).map((variant: { object_key: string }) => variant.object_key)),
        ];
        const storageResult = await deleteR2Objects(objectKeys);
        if (storageResult.errors.length) {
            console.error("R2 media deletion returned errors:", storageResult.errors);
            return jsonResponse({ error: "Cloudflare could not delete every media object." }, 502);
        }

        const { error: deleteError } = await authorization.supabase
            .from("media_assets")
            .delete()
            .eq("id", assetId);
        if (deleteError) throw deleteError;

        return jsonResponse({
            deleted: true,
            reason: "removed",
            deletedObjects: storageResult.deleted,
        });
    } catch (error) {
        console.error("Could not delete the media asset:", error);
        const message = error instanceof Error ? error.message : "Could not delete the media asset.";
        return jsonResponse({ error: message }, 500);
    }
};
