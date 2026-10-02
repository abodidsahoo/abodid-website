import { createHash, timingSafeEqual } from "node:crypto";

export const MOODBOARD_QUICK_ACTION_FOLDER = "photos/originals/moodboard";
export const MOODBOARD_QUICK_ACTION_MAX_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const IMAGE_TYPE_BY_EXTENSION: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export const readBearerToken = (request: Request) => {
    const authorization = request.headers.get("Authorization") || "";
    return authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";
};

export const securelyMatchesToken = (candidate: string, expected: string) => {
    if (!candidate || !expected) return false;
    return timingSafeEqual(sha256(candidate), sha256(expected));
};

export const isAuthorizedMoodboardQuickActionRequest = (request: Request) => {
    const expectedToken = (
        process.env.MOODBOARD_QUICK_ACTION_TOKEN ||
        (typeof import.meta !== "undefined" && import.meta.env?.MOODBOARD_QUICK_ACTION_TOKEN) ||
        ""
    ).trim();
    if (!expectedToken) return { authorized: false as const, configured: false as const };
    return {
        authorized: securelyMatchesToken(readBearerToken(request), expectedToken),
        configured: true as const,
    };
};

export const readMoodboardRequestFields = async (request: Request) => {
    const contentType = request.headers.get("content-type")?.toLowerCase() || "";
    if (contentType.includes("application/json")) {
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new Error("The request body must be a JSON object.");
        }
        return body as Record<string, unknown>;
    }

    const formData = await request.formData();
    return Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
};

export const resolveMoodboardImageType = (filename: string, declaredType: string) => {
    const normalizedType = declaredType.trim().toLowerCase();
    if (SUPPORTED_IMAGE_TYPES.has(normalizedType)) return normalizedType;

    const extension = filename.split(".").pop()?.toLowerCase() || "";
    return IMAGE_TYPE_BY_EXTENSION[extension] || "";
};

export const titleFromMoodboardFilename = (filename: string) =>
    filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) || "Untitled mood";

export const orientedImageDimensions = ({
    width,
    height,
    orientation,
}: {
    width?: number;
    height?: number;
    orientation?: number;
}) => {
    if (!width || !height) return { width: null, height: null };
    const rotated = orientation !== undefined && orientation >= 5 && orientation <= 8;
    return rotated
        ? { width: height, height: width }
        : { width, height };
};
