export const prerender = false;

import { getVaultTagIndex } from "../../lib/vault";

export async function GET() {
    try {
        const { index, notes } = await getVaultTagIndex();
        return new Response(
            JSON.stringify({
                ok: true,
                count: Array.isArray(notes) ? notes.length : 0,
                tagCount: index ? index.size : 0,
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
        console.error("[vault-warm] Failed:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Failed to warm vault cache." }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }
}
