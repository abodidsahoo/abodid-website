export const prerender = false;

import { findNotesReferencing } from "../../lib/vault";
import { findIndexedNotesByWikiLink } from "../../lib/vault-note-index.js";

const CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

function serializeLegacyNotes(notes) {
    return notes.map((note) => {
        const slug = note.name.replace(/\.md$/i, "");
        return {
            name: note.name,
            title: slug.replace(/-/g, " "),
            slug,
            href: `/research/obsidian-vault/${encodeURIComponent(slug)}`,
        };
    });
}

export async function GET({ url }) {
    const rawTag = (url.searchParams.get("tag") || "").trim();

    if (!rawTag) {
        return new Response(
            JSON.stringify({ ok: false, error: "Missing tag parameter.", count: 0, notes: [] }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }

    try {
        let serialized;
        let source = "supabase-index";

        try {
            serialized = await findIndexedNotesByWikiLink(rawTag);
        } catch (indexError) {
            source = "github-fallback";
            console.warn("[vault-tag-search] Indexed lookup failed; using GitHub fallback:", indexError);
            serialized = serializeLegacyNotes(await findNotesReferencing(rawTag));
        }

        return new Response(
            JSON.stringify({
                ok: true,
                tag: rawTag,
                count: serialized.length,
                notes: serialized,
                source,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": CACHE_CONTROL,
                },
            },
        );
    } catch (error) {
        console.error("[vault-tag-search] Failed:", error);
        return new Response(
            JSON.stringify({
                ok: false,
                error: "Failed to search tag references.",
                count: 0,
                notes: [],
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }
}
