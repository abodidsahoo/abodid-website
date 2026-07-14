import {
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
export const R2_UPLOAD_EXPIRY_SECONDS = 5 * 60;
export const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const R2_BROWSER_MAX_ITEMS = 2_000;
export const R2_SEARCH_MAX_OBJECTS = 25_000;

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

export type R2Config = {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
};

const cleanRequiredValue = (value: string | undefined, label: string) => {
    const cleaned = value?.trim();
    if (!cleaned) throw new Error(`Missing ${label}.`);
    return cleaned;
};

const normalizeEndpoint = (rawEndpoint: string, accountId: string) => {
    const fallback = accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : "";
    const endpoint = rawEndpoint || fallback;

    try {
        const parsed = new URL(endpoint);
        // The S3 client expects the account endpoint. Remove a bucket path if the
        // bucket-specific URL was copied from the Cloudflare settings screen.
        parsed.pathname = "";
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString().replace(/\/$/, "");
    } catch {
        throw new Error("R2_ENDPOINT is not a valid URL.");
    }
};

export const getR2Config = (): R2Config => {
    const accountId = (
        process.env.R2_ACCOUNT_ID || import.meta.env.R2_ACCOUNT_ID || ""
    ).trim();
    const endpoint = normalizeEndpoint(
        (process.env.R2_ENDPOINT || import.meta.env.R2_ENDPOINT || "").trim(),
        accountId,
    );

    return {
        endpoint,
        accessKeyId: cleanRequiredValue(
            process.env.R2_ACCESS_KEY_ID || import.meta.env.R2_ACCESS_KEY_ID,
            "R2_ACCESS_KEY_ID",
        ),
        secretAccessKey: cleanRequiredValue(
            process.env.R2_SECRET_ACCESS_KEY || import.meta.env.R2_SECRET_ACCESS_KEY,
            "R2_SECRET_ACCESS_KEY",
        ),
        bucket: cleanRequiredValue(
            process.env.R2_BUCKET_NAME || import.meta.env.R2_BUCKET_NAME,
            "R2_BUCKET_NAME",
        ),
        publicBaseUrl: cleanRequiredValue(
            process.env.R2_PUBLIC_BASE_URL || import.meta.env.R2_PUBLIC_BASE_URL,
            "R2_PUBLIC_BASE_URL",
        ).replace(/\/+$/, ""),
    };
};

const createR2Client = (config: R2Config) =>
    new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });

const sanitizeSegment = (value: string, fallback: string) => {
    const cleaned = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "")
        .slice(0, 100);
    return cleaned || fallback;
};

const slugifyFilenameStem = (value: string) => {
    const cleaned = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100);
    return cleaned || "image";
};

export const normalizeR2Folder = (value: unknown) => {
    const normalized = normalizeR2FolderPath(value);
    return normalized || "uploads";
};

export const normalizeR2FolderPath = (value: unknown) => {
    const segments = String(value || "")
        .split("/")
        .map((segment) => sanitizeSegment(segment, ""))
        .filter(Boolean)
        .slice(0, 8);

    return segments.join("/");
};

export const makeR2ObjectKey = (
    folder: string,
    originalFilename: string,
    copyNumber = 1,
) => {
    const lastFilenamePart = originalFilename.split(/[\\/]/).pop() || "image";
    const dotIndex = lastFilenamePart.lastIndexOf(".");
    const rawStem = dotIndex > 0 ? lastFilenamePart.slice(0, dotIndex) : lastFilenamePart;
    const rawExtension = dotIndex > 0 ? lastFilenamePart.slice(dotIndex + 1) : "";
    const stem = slugifyFilenameStem(rawStem);
    const extension = sanitizeSegment(rawExtension, "");
    const duplicateSuffix = copyNumber > 1 ? `-${copyNumber}` : "";
    const filename = `${stem}${duplicateSuffix}${extension ? `.${extension}` : ""}`;
    const folderPath = normalizeR2FolderPath(folder);
    return folderPath ? `${folderPath}/${filename}` : filename;
};

const isMissingR2ObjectError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const candidate = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
    };
    return (
        candidate.$metadata?.httpStatusCode === 404 ||
        candidate.name === "NotFound" ||
        candidate.name === "NoSuchKey"
    );
};

export const makeAvailableR2ObjectKey = async (
    folder: string,
    originalFilename: string,
) => {
    const config = getR2Config();
    const client = createR2Client(config);

    for (let copyNumber = 1; copyNumber <= 1_000; copyNumber += 1) {
        const objectKey = makeR2ObjectKey(folder, originalFilename, copyNumber);
        try {
            await client.send(
                new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
            );
        } catch (error) {
            if (isMissingR2ObjectError(error)) return objectKey;
            throw error;
        }
    }

    throw new Error("Could not find an available filename in this folder.");
};

export const isAllowedImageMimeType = (value: string) =>
    ALLOWED_IMAGE_MIME_TYPES.has(value);

export const assertSafeR2ObjectKey = (value: unknown) => {
    const key = String(value || "").trim();
    if (
        !key ||
        key.length > 1024 ||
        key.startsWith("/") ||
        key.includes("..") ||
        key.includes("\\")
    ) {
        throw new Error("Invalid R2 object key.");
    }
    return key;
};

export const buildR2PublicUrl = (config: R2Config, objectKey: string) => {
    const encodedKey = objectKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    return `${config.publicBaseUrl}/${encodedKey}`;
};

export const getR2Basename = (value: string) =>
    value.split("/").pop() || value;

export const inferR2MimeType = (objectKey: string) => {
    const extension = getR2Basename(objectKey).split(".").pop()?.toLowerCase() || "";
    return MIME_TYPES_BY_EXTENSION[extension] || "application/octet-stream";
};

export const listR2Folder = async (folder: unknown) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const folderPath = normalizeR2FolderPath(folder);
    const prefix = folderPath ? `${folderPath}/` : "";
    const folders = new Set<string>();
    const files: Array<{
        objectKey: string;
        fileSize: number;
        etag: string | null;
        lastModified: string | null;
    }> = [];
    let continuationToken: string | undefined;
    let truncated = false;

    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: prefix,
                Delimiter: "/",
                MaxKeys: 1_000,
                ContinuationToken: continuationToken,
            }),
        );

        for (const commonPrefix of response.CommonPrefixes || []) {
            const path = commonPrefix.Prefix?.replace(/\/$/, "");
            if (path) folders.add(path);
        }

        for (const object of response.Contents || []) {
            const objectKey = object.Key || "";
            if (!objectKey || objectKey.endsWith("/")) continue;
            files.push({
                objectKey,
                fileSize: Number(object.Size || 0),
                etag: object.ETag?.replace(/^"|"$/g, "") || null,
                lastModified: object.LastModified?.toISOString() || null,
            });
        }

        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
        truncated = Boolean(continuationToken);
    } while (
        continuationToken &&
        folders.size + files.length < R2_BROWSER_MAX_ITEMS
    );

    return {
        config,
        folderPath,
        folders: [...folders].slice(0, R2_BROWSER_MAX_ITEMS),
        files: files.slice(0, R2_BROWSER_MAX_ITEMS),
        truncated,
    };
};

export const searchR2Folder = async (folder: unknown, searchValue: unknown) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const folderPath = normalizeR2FolderPath(folder);
    const prefix = folderPath ? `${folderPath}/` : "";
    const rawSearchTerm = String(searchValue || "").trim();
    if (!rawSearchTerm || rawSearchTerm.length > 100) {
        throw new Error("Enter a search term up to 100 characters.");
    }
    const normalizeSearchText = (value: string) =>
        value
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    const searchTokens = normalizeSearchText(rawSearchTerm).split(/\s+/).filter(Boolean);
    if (!searchTokens.length) throw new Error("Enter a valid search term.");

    const files: Array<{
        objectKey: string;
        fileSize: number;
        etag: string | null;
        lastModified: string | null;
    }> = [];
    const folderMatches = new Map<string, number>();
    let continuationToken: string | undefined;
    let scannedObjects = 0;
    let truncated = false;

    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: prefix,
                MaxKeys: 1_000,
                ContinuationToken: continuationToken,
            }),
        );

        for (const object of response.Contents || []) {
            const objectKey = object.Key || "";
            if (!objectKey || objectKey.endsWith("/")) continue;
            scannedObjects += 1;

            const relativeKey = objectKey.slice(prefix.length);
            const searchableKey = normalizeSearchText(relativeKey);
            if (!searchTokens.every((token) => searchableKey.includes(token))) continue;

            if (files.length < R2_BROWSER_MAX_ITEMS) {
                files.push({
                    objectKey,
                    fileSize: Number(object.Size || 0),
                    etag: object.ETag?.replace(/^"|"$/g, "") || null,
                    lastModified: object.LastModified?.toISOString() || null,
                });
            } else {
                truncated = true;
            }

            const relativeParts = relativeKey.split("/").filter(Boolean);
            if (relativeParts.length > 1) {
                const immediateFolder = folderPath
                    ? `${folderPath}/${relativeParts[0]}`
                    : relativeParts[0];
                folderMatches.set(
                    immediateFolder,
                    (folderMatches.get(immediateFolder) || 0) + 1,
                );
            }
        }

        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
        if (continuationToken && scannedObjects >= R2_SEARCH_MAX_OBJECTS) {
            truncated = true;
            break;
        }
    } while (continuationToken);

    return {
        config,
        folderPath,
        files,
        folderMatches: [...folderMatches].map(([path, count]) => ({ path, count })),
        scannedObjects,
        truncated,
    };
};

export const createR2Folder = async (folder: unknown) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const folderPath = normalizeR2FolderPath(folder);
    if (!folderPath) throw new Error("Enter a valid folder name.");

    await client.send(
        new PutObjectCommand({
            Bucket: config.bucket,
            Key: `${folderPath}/`,
            Body: "",
            ContentType: "application/x-directory",
        }),
    );

    return { folderPath };
};

export const createPresignedR2Upload = async ({
    objectKey,
    contentType,
}: {
    objectKey: string;
    contentType: string;
}) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ContentType: contentType,
        CacheControl: R2_CACHE_CONTROL,
    });

    const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: R2_UPLOAD_EXPIRY_SECONDS,
    });

    return {
        uploadUrl,
        publicUrl: buildR2PublicUrl(config, objectKey),
        expiresIn: R2_UPLOAD_EXPIRY_SECONDS,
        requiredHeaders: {
            "Content-Type": contentType,
            "Cache-Control": R2_CACHE_CONTROL,
        },
    };
};

export const headR2Object = async (objectKey: string) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const object = await client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    );
    return { config, object };
};
