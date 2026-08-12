export const NEWSLETTER_EXHIBITION_FOLDER = 'originals/exhibition-photos';

export const isNewsletterGifAsset = (asset) => {
    const taggedAsGif = (Array.isArray(asset?.tags) ? asset.tags : [])
        .some((tag) => String(tag || '').trim().toLowerCase() === 'gif');
    if (taggedAsGif) return true;

    return [asset?.image_url, asset?.storage_path, asset?.title]
        .filter(Boolean)
        .some((value) => /\.gif(?:[?#].*)?$/i.test(String(value).trim()));
};

export const mapCloudflareNewsletterMedia = (files = []) => files
    .filter((file) => file?.publicUrl && String(file.mimeType || '').toLowerCase().startsWith('image/'))
    .map((file) => {
        const width = Number(file.width) || 0;
        const height = Number(file.height) || 0;
        const isGif = String(file.mimeType || '').toLowerCase() === 'image/gif'
            || [file.publicUrl, file.objectKey, file.name]
                .filter(Boolean)
                .some((value) => /\.gif(?:[?#].*)?$/i.test(String(value).trim()));

        return {
            id: file.id || file.objectKey || file.publicUrl,
            publicUrl: file.publicUrl,
            name: file.name || String(file.objectKey || '').split('/').pop() || 'Exhibition image',
            altText: file.altText || file.name || '',
            isGif,
            isLandscape: width > 0 && height > 0 && width > height,
        };
    });

export const loadNewsletterExhibitionMedia = async (accessToken, fetchImpl = fetch) => {
    const params = new URLSearchParams({ folder: NEWSLETTER_EXHIBITION_FOLDER });
    const response = await fetchImpl(`/api/admin/media?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not load exhibition images.');
    return mapCloudflareNewsletterMedia(payload.files);
};

export const replaceFirstNewsletterImage = (blocks, sample) => {
    if (!Array.isArray(blocks) || !sample?.publicUrl) return blocks;
    const imageIndex = blocks.findIndex((block) => block?.type === 'image');
    if (imageIndex === -1) return blocks;

    const nextBlocks = [...blocks];
    nextBlocks[imageIndex] = {
        ...nextBlocks[imageIndex],
        imageUrl: sample.publicUrl,
        alt: sample.altText || sample.name || nextBlocks[imageIndex].alt || '',
        previewImageUrl: '',
        previewImageAlt: '',
        previewSource: 'cloudflareExhibitions',
        previewLoading: false,
    };
    return nextBlocks;
};

export const pickNewsletterMedia = (media, type = 'image', excludedUrls = new Set()) => {
    const eligible = media.filter((item) => type === 'gif' ? item.isGif : !item.isGif);
    const landscape = type === 'image' ? eligible.filter((item) => item.isLandscape) : eligible;
    const preferred = landscape.length ? landscape : eligible;
    const unused = preferred.filter((item) => !excludedUrls.has(item.publicUrl));
    const pool = unused.length ? unused : preferred;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};
