import {
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
export const R2_UPLOAD_EXPIRY_SECONDS = 5 * 60;
export const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";

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
    const segments = String(value || "uploads")
        .split("/")
        .map((segment) => sanitizeSegment(segment, ""))
        .filter(Boolean)
        .slice(0, 8);

    return segments.join("/") || "uploads";
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
    return `${normalizeR2Folder(folder)}/${filename}`;
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
