export type MediaFile = { name?: string; objectKey: string; mimeType?: string; fileSize?: number; createdAt?: string; altText?: string; publicUrl?: string; folderPath?: string };
export const mediaType = (file: MediaFile) => {
    const mime = file.mimeType || '';
    if (mime.startsWith('image/')) return 'images';
    if (mime.startsWith('video/')) return 'videos';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('text/') || /pdf|document|presentation|spreadsheet|msword|ms-excel|ms-powerpoint|epub/.test(mime) || /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md|rtf|odt|ods|odp|epub)$/i.test(file.objectKey) || /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md|rtf|odt|ods|odp|epub)$/i.test(file.name || '')) return 'documents';
    return 'other';
};
export const filterLibraryFiles = <T extends MediaFile>(files: T[], { type = 'all', sort = 'date-desc', query = '' } = {}) => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return files.filter((file) => (type === 'all' || mediaType(file) === type) && tokens.every((token) => `${file.name} ${file.folderPath || ''} ${file.altText || ''} ${file.publicUrl || ''}`.toLowerCase().includes(token)))
        .sort((a, b) => {
            let result = 0;
            if (sort.startsWith('name')) result = (a.name || a.objectKey).localeCompare(b.name || b.objectKey, undefined, { numeric: true });
            else if (sort.startsWith('size')) result = Number(a.fileSize || 0) - Number(b.fileSize || 0);
            else result = (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
            if (sort.endsWith('desc')) result *= -1;
            return result || a.objectKey.localeCompare(b.objectKey);
        });
};
