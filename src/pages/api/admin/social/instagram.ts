export const prerender = false;

import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
    type AdminAuthorization,
} from "../../../../lib/admin/serverAuth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EDITABLE_STATUSES = new Set(["draft", "scheduled", "failed"]);

const readText = (value: unknown, field: string) => {
    if (typeof value !== "string") throw new Error(`${field} must be text.`);
    if (value.length > 2200) throw new Error(`${field} is too long.`);
    return value;
};

const readMediaIds = (value: unknown) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
        throw new Error("Choose between 1 and 10 photographs.");
    }
    const ids = value.map(String);
    if (ids.some((id) => !UUID_PATTERN.test(id))) throw new Error("A selected photograph is invalid.");
    if (new Set(ids).size !== ids.length) throw new Error("A photograph can only be selected once.");
    return ids;
};

const validateCopy = (caption: string, hashtags: string) => {
    const hashtagBlock = hashtags.trim();
    const combined = hashtagBlock ? `${caption}${caption ? "\n\n" : ""}${hashtagBlock}` : caption;
    if (combined.length > 2200) throw new Error("Caption and hashtags together exceed Instagram’s 2,200 character limit.");
    const hashtagCount = Array.from(hashtags.matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu)).length;
    if (hashtagCount > 30) throw new Error("Instagram allows up to 30 hashtags.");
};

const readScheduledAt = (value: unknown) => {
    if (typeof value !== "string") throw new Error("Choose a date and time.");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Choose a valid date and time.");
    if (date.getTime() < Date.now() + 15_000) throw new Error("Scheduled time must be in the future.");
    return date.toISOString();
};

const bearerToken = (request: Request) => {
    const authorization = request.headers.get("Authorization") || "";
    return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
};

const publisherUrl = () => {
    const base = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    return base ? `${base.replace(/\/$/, "")}/functions/v1/instagram-publisher` : "";
};

const invokePublisher = async (request: Request, body: Record<string, unknown>) => {
    const url = publisherUrl();
    const token = bearerToken(request);
    if (!url || !token) throw new Error("Supabase publishing is not configured.");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(import.meta.env.PUBLIC_SUPABASE_ANON_KEY
                ? { apikey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY }
                : {}),
        },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Instagram publishing failed.");
    return payload;
};

const loadPost = async (authorization: Extract<AdminAuthorization, { ok: true }>, id: string) => {
    const { data, error } = await authorization.supabase
        .from("social_posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
    if (error) throw error;
    return data;
};

const mapPostsWithMedia = async (
    authorization: Extract<AdminAuthorization, { ok: true }>,
    posts: any[],
) => {
    const ids = [...new Set(posts.flatMap((post) => post.media_order || []))];
    if (!ids.length) return posts.map((post) => ({ ...post, media: [] }));
    const { data, error } = await authorization.supabase
        .from("media_assets")
        .select("id,original_filename,public_url,alt_text,mime_type,width,height,media_variants(variant_key,public_url)")
        .in("id", ids);
    if (error) throw error;
    const byId = new Map((data || []).map((asset: any) => [asset.id, asset]));
    return posts.map((post) => ({
        ...post,
        media: (post.media_order || []).map((id: string) => {
            const asset: any = byId.get(id);
            if (!asset) return { id, missing: true };
            const variants = Array.isArray(asset.media_variants) ? asset.media_variants : [];
            const image = variants.find((item: any) => item.variant_key === "800")
                || variants.find((item: any) => item.variant_key === "1600");
            return {
                id,
                name: asset.original_filename,
                url: image?.public_url || asset.public_url,
                altText: asset.alt_text || asset.original_filename,
                mimeType: asset.mime_type,
                mediaKind: String(asset.mime_type || "").startsWith("video/") ? "video" : "image",
                width: asset.width,
                height: asset.height,
                publishable: true,
            };
        }),
    }));
};

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const [{ data: posts, error: postsError }, { data: settings, error: settingsError }] = await Promise.all([
            authorization.supabase
                .from("social_posts")
                .select("*")
                .eq("platform", "instagram")
                .order("created_at", { ascending: false })
                .limit(60),
            authorization.supabase
                .from("social_instagram_settings")
                .select("default_hashtags,username")
                .eq("id", true)
                .maybeSingle(),
        ]);
        if (postsError || settingsError) throw postsError || settingsError;

        let connection: Record<string, unknown> = { connected: false };
        try {
            connection = await invokePublisher(request, { action: "connection" });
            if (connection.connected && connection.username && connection.username !== settings?.username) {
                await authorization.supabase
                    .from("social_instagram_settings")
                    .update({ username: connection.username, updated_by: authorization.user.id })
                    .eq("id", true);
            }
        } catch (error) {
            connection = {
                connected: false,
                error: error instanceof Error ? error.message : "Instagram is not configured.",
            };
        }

        return jsonResponse({
            posts: await mapPostsWithMedia(authorization, posts || []),
            settings: settings || { default_hashtags: "", username: "" },
            connection,
        });
    } catch (error) {
        console.error("Could not load Instagram publishing data:", error);
        return jsonResponse({ error: "Could not load Instagram publishing." }, 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        if (body?.action === "publish") {
            const id = typeof body.id === "string" ? body.id : "";
            if (!UUID_PATTERN.test(id)) return jsonResponse({ error: "Invalid post." }, 400);
            const payload = await invokePublisher(request, { postId: id });
            return jsonResponse(payload);
        }

        const mediaIds = readMediaIds(body?.mediaIds);
        const caption = readText(body?.caption ?? "", "Caption");
        const hashtags = readText(body?.hashtags ?? "", "Hashtags");
        validateCopy(caption, hashtags);
        const mode = body?.mode === "schedule" ? "schedule" : body?.mode === "now" ? "now" : "";
        if (!mode) return jsonResponse({ error: "Choose Post now or Schedule." }, 400);
        const scheduledAt = mode === "schedule" ? readScheduledAt(body?.scheduledAt) : null;

        const { data: post, error } = await authorization.supabase
            .from("social_posts")
            .insert({
                platform: "instagram",
                media_ids: mediaIds,
                media_order: mediaIds,
                caption,
                hashtags,
                status: mode === "schedule" ? "scheduled" : "draft",
                scheduled_at: scheduledAt,
                created_by: authorization.user.id,
            })
            .select("*")
            .single();
        if (error) throw error;

        if (mode === "schedule") return jsonResponse({ post }, 201);
        try {
            const published = await invokePublisher(request, { postId: post.id });
            return jsonResponse(published, 201);
        } catch (publishError) {
            const failedPost = await loadPost(authorization, post.id);
            return jsonResponse({
                error: publishError instanceof Error ? publishError.message : "Instagram publishing failed.",
                post: failedPost,
            }, 502);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save the Instagram post.";
        console.error("Could not create Instagram post:", message);
        return jsonResponse({ error: message }, 400);
    }
};

export const PATCH: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        if (body?.action === "settings") {
            const defaultHashtags = readText(body?.defaultHashtags ?? "", "Default hashtags");
            const { data, error } = await authorization.supabase
                .from("social_instagram_settings")
                .update({ default_hashtags: defaultHashtags, updated_by: authorization.user.id })
                .eq("id", true)
                .select("default_hashtags,username")
                .single();
            if (error) throw error;
            return jsonResponse({ settings: data });
        }

        const id = typeof body?.id === "string" ? body.id : "";
        if (!UUID_PATTERN.test(id)) return jsonResponse({ error: "Invalid post." }, 400);
        const existing = await loadPost(authorization, id);
        if (!existing) return jsonResponse({ error: "Post not found." }, 404);
        if (!EDITABLE_STATUSES.has(existing.status)) {
            return jsonResponse({ error: "A publishing or published post cannot be edited." }, 409);
        }

        const mediaIds = readMediaIds(body?.mediaIds);
        const caption = readText(body?.caption ?? "", "Caption");
        const hashtags = readText(body?.hashtags ?? "", "Hashtags");
        validateCopy(caption, hashtags);
        const mode = body?.mode === "schedule" ? "schedule" : body?.mode === "now" ? "now" : "";
        if (!mode) return jsonResponse({ error: "Choose Post now or Schedule." }, 400);
        const scheduledAt = mode === "schedule" ? readScheduledAt(body?.scheduledAt) : null;
        const { data, error } = await authorization.supabase
            .from("social_posts")
            .update({
                media_ids: mediaIds,
                media_order: mediaIds,
                caption,
                hashtags,
                status: mode === "schedule" ? "scheduled" : "draft",
                scheduled_at: scheduledAt,
                error_message: null,
                instagram_container_id: null,
                publish_state: {},
            })
            .eq("id", id)
            .in("status", [...EDITABLE_STATUSES])
            .select("*")
            .single();
        if (error) throw error;
        return jsonResponse({ post: data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update the post.";
        return jsonResponse({ error: message }, 400);
    }
};

export const DELETE: APIRoute = async ({ request, url }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    const id = url.searchParams.get("id") || "";
    if (!UUID_PATTERN.test(id)) return jsonResponse({ error: "Invalid post." }, 400);

    const { data, error } = await authorization.supabase
        .from("social_posts")
        .delete()
        .eq("id", id)
        .in("status", [...EDITABLE_STATUSES])
        .select("id")
        .maybeSingle();
    if (error) return jsonResponse({ error: "Could not delete the post." }, 500);
    if (!data) return jsonResponse({ error: "Publishing or published posts cannot be deleted." }, 409);
    return jsonResponse({ deleted: true, id });
};
