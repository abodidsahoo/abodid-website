export const prerender = false;

import { findNotesReferencing } from "../../lib/vault";

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
        const notes = await findNotesReferencing(rawTag);

        const serialized = notes.map((note) => {
            const slug = note.name.replace(/\.md$/i, "");
            return {
                name: note.name,
                slug,
                href: `/research/obsidian-vault/${encodeURIComponent(slug)}`,
            };
        });

        return new Response(
            JSON.stringify({
                ok: true,
                tag: rawTag,
                count: serialized.length,
                notes: serialized,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
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
