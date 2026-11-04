import { normalizeUploadContentType } from './uploadPolicy';

export const readMediaResponse = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}.`);
    return payload;
};

export async function uploadLibraryFile(file, folder, dimensions, authorizedFetch) {
    const signed = await readMediaResponse(await authorizedFetch('/api/admin/media/presign', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: normalizeUploadContentType(file.type), size: file.size, folder }),
    }));
    // File bytes bypass the site's serverless request-size limit. Never send the
    // admin bearer token to the signed R2 URL.
    const response = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.requiredHeaders, body: file });
    if (!response.ok) throw new Error(`Cloudflare rejected the upload with status ${response.status}.`);
    return readMediaResponse(await authorizedFetch('/api/admin/media/complete', {
        method: 'POST',
        body: JSON.stringify({ objectKey: signed.objectKey, originalFilename: file.name, expectedSize: file.size, ...dimensions }),
    }));
}

// Flatten folders into one ZIP, disambiguating duplicate names without losing
// extensions. Strip paths from supplied filenames to keep extraction safe.
export function archiveEntryNames(files) {
    const used = new Set();
    return files.map((file) => {
        const base = (file.name || file.objectKey.split('/').pop() || 'file')
            .split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '_');
        const safe = !base || /^\.+$/.test(base) ? 'file' : base;
        const dot = safe.lastIndexOf('.');
        const stem = dot > 0 ? safe.slice(0, dot) : safe;
        const extension = dot > 0 ? safe.slice(dot) : '';
        let name = safe;
        for (let copy = 2; used.has(name.toLowerCase()); copy += 1) name = `${stem} (${copy})${extension}`;
        used.add(name.toLowerCase());
        return name;
    });
}

export async function createLibraryArchive(files, onProgress = () => {}, fetchFile = (file) => fetch(file.downloadUrl)) {
    const { Zip, ZipPassThrough } = await import('fflate');
    const chunks = [];
    let zipError;
    let totalBytes = 0;
    const zip = new Zip((error, chunk) => {
        if (error) zipError = error;
        else chunks.push(chunk);
    });
    const names = archiveEntryNames(files);
    try {
        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            onProgress({ current: index + 1, total: files.length, filename: file.name });
            const response = await fetchFile(file);
            if (!response.ok || !response.body) throw new Error(`Could not download ${file.name} (${response.status}).`);
            const entry = new ZipPassThrough(names[index]);
            zip.add(entry);
            const reader = response.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    totalBytes += value.byteLength;
                    // fflate emits ZIP32. Fail visibly before producing a corrupt archive.
                    if (totalBytes >= 0xf0000000) throw new Error('This selection is too large for one ZIP. Download fewer files at a time.');
                    entry.push(value, false);
                    if (zipError) throw zipError;
                }
                entry.push(new Uint8Array(0), true);
            } finally {
                await reader.cancel().catch(() => {});
                reader.releaseLock();
            }
        }
        zip.end();
        if (zipError) throw zipError;
        return new Blob(chunks, { type: 'application/zip' });
    } catch (error) {
        zip.terminate();
        throw error;
    }
}

export function saveLibraryBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Keep the URL alive until the browser has started saving the archive.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
