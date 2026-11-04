// Shared by the file picker and server verification. File extensions are not an
// allowlist: browsers often leave the MIME type blank for design/source files.
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_UPLOAD_BYTES = 100 * 1024 * 1024;

export const normalizeUploadContentType = (value: unknown) => {
    const type = typeof value === "string" ? value.trim().toLowerCase() : "";
    return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type)
        ? type
        : "application/octet-stream";
};

export const maxUploadBytes = (contentType: string) =>
    contentType.startsWith("image/") ? MAX_IMAGE_UPLOAD_BYTES : MAX_FILE_UPLOAD_BYTES;
