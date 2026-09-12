export type WorkingPhoto = {
    blob: Blob;
    filename: string;
    width: number;
    height: number;
};

const MAX_BYTES = 1024 * 1024;
const MAX_EDGE = 2400;

const loadBitmap = async (file: Blob) => {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.decoding = 'async';
            image.src = url;
            await image.decode();
            return image;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
};

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed.')), type, quality);
    });

export async function createWorkingPhoto(file: File): Promise<WorkingPhoto> {
    const name = file.name.toLowerCase();
    const accepted = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/heic' || file.type === 'image/heif' || /\.(jpe?g|png|heic|heif)$/i.test(name);
    if (!accepted) throw new Error(`${file.name} is not a JPG, PNG or HEIC image.`);

    let decodableSource: Blob = file;
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(name);
    if (isHeic) {
        try {
            const { default: heic2any } = await import('heic2any');
            const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: .94 });
            decodableSource = Array.isArray(converted) ? converted[0] : converted;
        } catch {
            throw new Error(`${file.name} could not be converted from HEIC.`);
        }
    }

    let bitmap: ImageBitmap | HTMLImageElement;
    try {
        bitmap = await loadBitmap(decodableSource);
    } catch {
        throw new Error(`${file.name} could not be decoded in this browser.`);
    }

    const sourceWidth = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
    const sourceHeight = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
    const ratio = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * ratio));
    let height = Math.max(1, Math.round(sourceHeight * ratio));
    let quality = 0.9;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Image processing is unavailable.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        blob = await canvasBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= MAX_BYTES) break;
        if (quality > 0.58) quality -= 0.08;
        else {
            width = Math.max(1, Math.round(width * 0.84));
            height = Math.max(1, Math.round(height * 0.84));
        }
    }
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    if (!blob || blob.size > MAX_BYTES) throw new Error(`${file.name} could not be reduced below 1 MB.`);

    return {
        blob,
        filename: `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`,
        width,
        height,
    };
}
