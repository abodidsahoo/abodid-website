import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    createR2Folder,
    isR2OriginalFolder,
    normalizeR2FolderPath,
} from "../../../../lib/media/r2";

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const parentPath = normalizeR2FolderPath(body?.parentPath);
        const rawName = typeof body?.name === "string" ? body.name.trim() : "";

        if (!rawName || rawName.length > 100 || rawName.includes("/") || rawName.includes("\\")) {
            return jsonResponse({ error: "Enter a folder name up to 100 characters." }, 400);
        }

        const requestedPath = parentPath ? `${parentPath}/${rawName}` : rawName;
        if (!isR2OriginalFolder(requestedPath)) {
            return jsonResponse({ error: "Create collection folders inside Originals." }, 400);
        }
        const folder = await createR2Folder(requestedPath);
        const name = folder.folderPath.split("/").pop() || folder.folderPath;

        return jsonResponse({ folder: { name, path: folder.folderPath } }, 201);
    } catch (error) {
        console.error("Could not create an R2 folder:", error);
        const message = error instanceof Error ? error.message : "Could not create the folder.";
        return jsonResponse({ error: message }, 500);
    }
};
