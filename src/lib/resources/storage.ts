import { supabase } from '../supabaseClient';

export const HUB_THUMBNAILS_BUCKET = 'hub_thumbnails';
export const HUB_THUMBNAILS_FOLDER = 'resource-thumbnails';

const MAX_THUMBNAIL_SIZE_BYTES = 8 * 1024 * 1024;

function slugifyBaseName(fileName: string): string {
    const base = fileName.replace(/\.[^/.]+$/, '');
    return base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'thumbnail';
}

function getFileExtension(file: File): string {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName) return fromName;

    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/svg+xml': 'svg'
    };

    return mimeToExt[file.type] || 'jpg';
}

export async function uploadResourceThumbnail(resourceId: string, file: File): Promise<{ publicUrl: string; path: string }> {
    if (!supabase) throw new Error('Database not connected');

    if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file.');
    }

    if (file.size > MAX_THUMBNAIL_SIZE_BYTES) {
        throw new Error('Image is too large. Max size is 8MB.');
    }

    const fileExt = getFileExtension(file);
    const fileName = `${Date.now()}-${slugifyBaseName(file.name)}.${fileExt}`;
    const filePath = `${HUB_THUMBNAILS_FOLDER}/${resourceId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(HUB_THUMBNAILS_BUCKET)
        .upload(filePath, file, {
            cacheControl: '31536000',
            upsert: false,
            contentType: file.type
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage
        .from(HUB_THUMBNAILS_BUCKET)
        .getPublicUrl(filePath);

    return { publicUrl, path: filePath };
}
