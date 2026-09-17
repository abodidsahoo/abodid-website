import snapshot from "../../data/photographyR2.generated.json";
import { listR2Folder, buildR2PublicUrl, type R2Config } from "../media/r2";

export interface MoodboardPhotoItem {
    id: string;
    title: string;
    imageUrl: string;
    thumbnailUrl: string;
    paletteImageUrl: string;
    objectKey?: string;
    etag?: string;
}

export interface MoodboardLoaderOptions {
    defaultTitlePrefix?: string;
    bucket?: string;
    shuffle?: boolean;
}

const PUBLIC_ASSETS_CONFIG: R2Config = {
    endpoint: "https://assets.abodid.com",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "assets",
    publicBaseUrl: "https://assets.abodid.com",
};

/**
 * Clean and humanize a filename stem into a readable photo title
 */
export function formatPhotoTitle(rawStem: string, defaultPrefix = "Photo"): string {
    const cleaned = rawStem
        .replace(/\.[^/.]+$/, "") // remove extension
        .replace(/^[0-9]+[_-]/, "") // remove leading index numbers if desired or clean
        .replace(/[-_]+/g, " ")
        .trim();

    if (!cleaned) return defaultPrefix;

    // Capitalize first letters
    return cleaned
        .split(" ")
        .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
        .join(" ");
}

/**
 * Load photos for a moodboard folder (e.g., 'uk-2026', 'my-life', 'boudoir')
 * Tries live R2 in the 'assets' bucket first; if unavailable or empty, falls back to the generated R2 snapshot.
 */
export async function getMoodboardPhotos(
    folderName: string,
    options: MoodboardLoaderOptions = {},
): Promise<MoodboardPhotoItem[]> {
    const bucket = options.bucket || "assets";
    const defaultPrefix = options.defaultTitlePrefix || folderName;

    const folderSlug = folderName.replace(/^\/+|\/+$/g, "");
    const prefix1600 = `photos/variants/${folderSlug}/1600/`;
    const prefix800 = `photos/variants/${folderSlug}/800/`;
    const prefixOrig = `photos/originals/${folderSlug}/`;

    type FileEntry = { objectKey: string; etag?: string | null };
    let files1600: FileEntry[] = [];
    let files800: FileEntry[] = [];
    let filesOrig: FileEntry[] = [];

    // 1. Attempt live R2 query
    try {
        const [res1600, res800] = await Promise.all([
            listR2Folder(prefix1600, bucket).catch(() => ({ files: [] })),
            listR2Folder(prefix800, bucket).catch(() => ({ files: [] })),
        ]);

        files1600 = res1600.files || [];
        files800 = res800.files || [];

        if (files1600.length === 0 && files800.length === 0) {
            const resOrig = await listR2Folder(prefixOrig, bucket).catch(() => ({ files: [] }));
            filesOrig = resOrig.files || [];
        }
    } catch {
        // Ignore live fetch errors; will fallback to snapshot below
    }

    // 2. Fallback to generated snapshot if live list returned nothing
    if (files1600.length === 0 && files800.length === 0 && filesOrig.length === 0) {
        const snapArray = snapshot as Array<{ key: string; etag?: string }>;

        files1600 = snapArray
            .filter((item) => item.key.startsWith(prefix1600))
            .map((item) => ({ objectKey: item.key, etag: item.etag }));

        files800 = snapArray
            .filter((item) => item.key.startsWith(prefix800))
            .map((item) => ({ objectKey: item.key, etag: item.etag }));

        if (files1600.length === 0 && files800.length === 0) {
            filesOrig = snapArray
                .filter((item) => item.key.startsWith(prefixOrig))
                .map((item) => ({ objectKey: item.key, etag: item.etag }));
        }
    }

    // 3. Normalize & pair 1600, 800, and original keys
    // Helper to get normalized stem without hash suffix
    const extractStemKey = (objectKey: string) => {
        const filename = objectKey.split("/").pop() || "";
        const stem = filename.replace(/\.[^/.]+$/, "");
        // Remove 10-char hex hash suffix if present (e.g. -81a3492868)
        return stem.replace(/-[a-f0-9]{10}$/i, "");
    };

    const fileMap = new Map<
        string,
        { key1600?: string; key800?: string; keyOrig?: string; etag?: string; rawFilename: string }
    >();

    for (const file of files1600) {
        const rawFilename = file.objectKey.split("/").pop() || "";
        const stemKey = extractStemKey(file.objectKey);
        const existing = fileMap.get(stemKey) || { rawFilename };
        existing.key1600 = file.objectKey;
        if (file.etag) existing.etag = file.etag.replace(/"/g, "");
        fileMap.set(stemKey, existing);
    }

    for (const file of files800) {
        const rawFilename = file.objectKey.split("/").pop() || "";
        const stemKey = extractStemKey(file.objectKey);
        const existing = fileMap.get(stemKey) || { rawFilename };
        existing.key800 = file.objectKey;
        if (!existing.etag && file.etag) existing.etag = file.etag.replace(/"/g, "");
        fileMap.set(stemKey, existing);
    }

    for (const file of filesOrig) {
        const rawFilename = file.objectKey.split("/").pop() || "";
        const stemKey = extractStemKey(file.objectKey);
        const existing = fileMap.get(stemKey) || { rawFilename };
        existing.keyOrig = file.objectKey;
        if (!existing.etag && file.etag) existing.etag = file.etag.replace(/"/g, "");
        fileMap.set(stemKey, existing);
    }

    const sortedStems = Array.from(fileMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

    const photos: MoodboardPhotoItem[] = sortedStems.map((stem, index) => {
        const data = fileMap.get(stem)!;
        const gridKey = data.key800 || data.key1600 || data.keyOrig || "";
        const highResKey = data.key1600 || data.keyOrig || data.key800 || "";

        const imageUrl = buildR2PublicUrl(PUBLIC_ASSETS_CONFIG, highResKey);
        const thumbnailUrl = buildR2PublicUrl(PUBLIC_ASSETS_CONFIG, gridKey);

        const title = formatPhotoTitle(stem, `${defaultPrefix} ${index + 1}`);
        const id = data.etag || `${folderSlug}-${index + 1}`;

        return {
            id,
            title,
            imageUrl,
            thumbnailUrl,
            paletteImageUrl: `/api/image-palette-proxy?url=${encodeURIComponent(thumbnailUrl)}`,
            objectKey: highResKey,
            etag: data.etag,
        };
    });

    if (options.shuffle) {
        for (let i = photos.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [photos[i], photos[j]] = [photos[j], photos[i]];
        }
    }

    return photos;
}
