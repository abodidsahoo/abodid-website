export const prerender = false;

import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { APIRoute } from "astro";
import ffmpegPath from "ffmpeg-static";
import { authorizeAdminRequest, jsonResponse } from "../../../../lib/admin/serverAuth";
import {
    assertR2OriginalObjectKey,
    buildR2PublicUrl,
    getR2Basename,
    getR2ObjectBytes,
    headR2Object,
    putR2Object,
    R2_INSTAGRAM_PREFIX,
} from "../../../../lib/media/r2";

const POST_FORMATS = {
    portrait: { width: 1080, height: 1350 },
    square: { width: 1080, height: 1080 },
    landscape: { width: 1080, height: 566 },
    reel: { width: 1080, height: 1920 },
} as const;

const bounded = (value: unknown, fallback: number, minimum: number, maximum: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const runFfmpeg = (args: string[]) => new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("Video preparation is unavailable on this server."));
    const process = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let diagnostics = "";
    process.stderr.on("data", (chunk) => { diagnostics = `${diagnostics}${chunk}`.slice(-8000); });
    process.once("error", reject);
    process.once("close", (code) => code === 0
        ? resolve()
        : reject(new Error(diagnostics.trim() || `Video conversion failed (${code}).`)));
});

const mapAsset = (asset: Record<string, any>) => ({
    id: asset.id,
    objectKey: asset.object_key,
    publicUrl: asset.public_url,
    originalFilename: asset.original_filename,
    mimeType: asset.mime_type,
    fileSize: asset.file_size,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.duration_seconds,
    catalogued: true,
    processingStatus: asset.processing_status,
    variants: {},
});

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    let workDirectory = "";
    try {
        const body = await request.json();
        const objectKey = assertR2OriginalObjectKey(body?.objectKey);
        const format = typeof body?.format === "string" && body.format in POST_FORMATS
            ? body.format as keyof typeof POST_FORMATS
            : "portrait";
        const dimensions = POST_FORMATS[format];
        const crop = {
            fit: body?.crop?.fit === "contain" ? "contain" : "cover",
            zoom: bounded(body?.crop?.zoom, 1, 1, 3),
            positionX: bounded(body?.crop?.positionX, 0.5, 0, 1),
            positionY: bounded(body?.crop?.positionY, 0.5, 0, 1),
        };
        const suppliedName = typeof body?.originalFilename === "string"
            ? body.originalFilename.trim().slice(0, 255)
            : "";
        const originalFilename = suppliedName || getR2Basename(objectKey);
        const { config, object } = await headR2Object(objectKey);
        const mimeType = String(object.ContentType || "").toLowerCase();
        if (!mimeType.startsWith("video/")) {
            return jsonResponse({ error: "Choose an original video from the Media Library." }, 400);
        }

        const sourceBytes = await getR2ObjectBytes(objectKey);
        const layoutSignature = JSON.stringify({ format, ...dimensions, ...crop });
        const fingerprint = createHash("sha256")
            .update(sourceBytes)
            .update(layoutSignature)
            .digest("hex")
            .slice(0, 18);
        const relativePath = objectKey.replace(/^photos\/originals\//, "").replace(/^originals\//, "");
        const slash = relativePath.lastIndexOf("/");
        const directory = slash >= 0 ? relativePath.slice(0, slash) : "";
        const sourceName = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
        const stem = sourceName.replace(/\.[^.]+$/, "");
        const instagramObjectKey = `${R2_INSTAGRAM_PREFIX}/${directory ? `${directory}/` : ""}${stem}-${fingerprint}.mp4`;

        const { data: cached } = await authorization.supabase
            .from("media_assets")
            .select("id,object_key,public_url,original_filename,mime_type,file_size,width,height,duration_seconds,processing_status")
            .eq("storage_provider", "cloudflare_r2")
            .eq("storage_bucket", config.bucket)
            .eq("object_key", instagramObjectKey)
            .maybeSingle();
        if (cached) return jsonResponse({ asset: mapAsset(cached), converted: true, cached: true });

        workDirectory = join(tmpdir(), `instagram-video-${randomUUID()}`);
        await mkdir(workDirectory, { recursive: true });
        const inputPath = join(workDirectory, `source${sourceName.match(/\.[^.]+$/)?.[0] || ".video"}`);
        const outputPath = join(workDirectory, "instagram.mp4");
        await writeFile(inputPath, sourceBytes);

        const { width, height } = dimensions;
        const scaleMode = crop.fit === "cover" ? "max" : "min";
        const scaleExpression = `min(3,${crop.zoom})*${scaleMode}(${width}/iw,${height}/ih)`;
        const scaledWidth = `trunc(iw*(${scaleExpression})/2)*2`;
        const scaledHeight = `trunc(ih*(${scaleExpression})/2)*2`;
        const videoFilter = crop.fit === "cover"
            ? `scale=w='${scaledWidth}':h='${scaledHeight}',crop=${width}:${height}:(in_w-out_w)*${crop.positionX}:(in_h-out_h)*${crop.positionY},fps=30`
            : `scale=w='${scaledWidth}':h='${scaledHeight}',crop=min(iw\,${width}):min(ih\,${height}):(in_w-out_w)*${crop.positionX}:(in_h-out_h)*${crop.positionY},pad=${width}:${height}:(ow-iw)*${crop.positionX}:(oh-ih)*${crop.positionY}:black,fps=30`;

        await runFfmpeg([
            "-y", "-i", inputPath,
            "-vf", videoFilter,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-maxrate", "10M", "-bufsize", "20M",
            "-c:a", "aac", "-ar", "48000", "-b:a", "128k",
            "-movflags", "+faststart", outputPath,
        ]);
        const outputBytes = await readFile(outputPath);
        const uploaded = await putR2Object({
            objectKey: instagramObjectKey,
            body: new Uint8Array(outputBytes),
            contentType: "video/mp4",
        });
        const folderSlash = instagramObjectKey.lastIndexOf("/");
        const { data: asset, error } = await authorization.supabase
            .from("media_assets")
            .upsert({
                storage_provider: "cloudflare_r2",
                storage_bucket: config.bucket,
                object_key: instagramObjectKey,
                folder_path: instagramObjectKey.slice(0, folderSlash),
                public_url: uploaded.publicUrl || buildR2PublicUrl(config, instagramObjectKey),
                original_filename: `${stem}.mp4`,
                mime_type: "video/mp4",
                file_size: outputBytes.byteLength,
                width,
                height,
                created_by: authorization.user.id,
                processing_status: "ready",
                ready_at: new Date().toISOString(),
                metadata: {
                    generatedFor: "instagram",
                    sourceObjectKey: objectKey,
                    sourceEtag: object.ETag?.replace(/^"|"$/g, "") || null,
                    postFormat: format,
                    crop,
                },
            }, { onConflict: "storage_provider,storage_bucket,object_key" })
            .select("id,object_key,public_url,original_filename,mime_type,file_size,width,height,duration_seconds,processing_status")
            .single();
        if (error) throw error;
        return jsonResponse({ asset: mapAsset(asset), converted: true });
    } catch (error) {
        console.error("Could not prepare Instagram video:", error);
        const message = error instanceof Error ? error.message : "Could not prepare this video.";
        return jsonResponse({ error: message }, 500);
    } finally {
        if (workDirectory) await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
};
