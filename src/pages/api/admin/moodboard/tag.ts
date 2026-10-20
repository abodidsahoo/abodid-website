export const prerender = false;

import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, jsonResponse } from "../../../../lib/admin/serverAuth";
import {
    MASTER_TAGGING_VERSION,
    buildVocabularyHints,
    mergeProtectedTags,
} from "../../../../lib/moodboard/tagging";
import { requestMasterTags } from "../../../../lib/moodboard/taggingServer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ITEM_FIELDS = "id,image_url,title,tags,artist_name,updated_at";
const MAX_MERGE_ATTEMPTS = 3;

const readVocabularyRows = async (supabase: SupabaseClient) => {
    const rows: Array<{ tags?: unknown }> = [];
    const pageSize = 1_000;
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from("moodboard_items")
            .select("tags")
            .range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < pageSize) break;
    }
    return rows;
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json() as { itemId?: unknown };
        const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
        if (!UUID_PATTERN.test(itemId)) {
            return jsonResponse({ error: "Choose a valid moodboard image." }, 400);
        }

        const [{ data: item, error: itemError }, vocabularyRows] = await Promise.all([
            authorization.supabase
                .from("moodboard_items")
                .select(ITEM_FIELDS)
                .eq("id", itemId)
                .single(),
            readVocabularyRows(authorization.supabase),
        ]);
        if (itemError || !item) {
            return jsonResponse({ error: "The moodboard image was not found." }, 404);
        }

        const analysis = await requestMasterTags({
            imageUrl: item.image_url,
            title: item.title,
            artistName: item.artist_name,
            existingTags: item.tags,
            vocabularyHints: buildVocabularyHints(vocabularyRows),
        });

        for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt += 1) {
            const { data: latest, error: latestError } = await authorization.supabase
                .from("moodboard_items")
                .select(ITEM_FIELDS)
                .eq("id", itemId)
                .single();
            if (latestError || !latest) throw latestError || new Error("The image no longer exists.");

            const merged = mergeProtectedTags(latest.tags, analysis.tags);
            if (!merged.appended.length) {
                return jsonResponse({
                    item: latest,
                    appended: [],
                    generated: analysis.tags,
                    taggingVersion: MASTER_TAGGING_VERSION,
                    model: analysis.model,
                    latencyMs: analysis.latencyMs,
                    usage: analysis.usage,
                });
            }

            const { data: updated, error: updateError } = await authorization.supabase
                .from("moodboard_items")
                .update({ tags: merged.tags })
                .eq("id", itemId)
                .eq("updated_at", latest.updated_at)
                .select(ITEM_FIELDS)
                .maybeSingle();
            if (updateError) throw updateError;
            if (updated) {
                return jsonResponse({
                    item: updated,
                    appended: merged.appended,
                    generated: analysis.tags,
                    taggingVersion: MASTER_TAGGING_VERSION,
                    model: analysis.model,
                    latencyMs: analysis.latencyMs,
                    usage: analysis.usage,
                });
            }
        }

        return jsonResponse({
            error: "Tags changed while the AI result was being saved. Nothing was overwritten; retry when ready.",
        }, 409);
    } catch (error) {
        console.error("Master Tag Builder failed:", error);
        const message = error instanceof Error ? error.message : "Could not build tags.";
        return jsonResponse({ error: message }, 500);
    }
};
