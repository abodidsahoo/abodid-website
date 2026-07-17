export const isNewsletterGifAsset = (asset) => {
    const taggedAsGif = (Array.isArray(asset?.tags) ? asset.tags : [])
        .some((tag) => String(tag || '').trim().toLowerCase() === 'gif');
    if (taggedAsGif) return true;

    return [asset?.image_url, asset?.storage_path, asset?.title]
        .filter(Boolean)
        .some((value) => /\.gif(?:[?#].*)?$/i.test(String(value).trim()));
};

export const pickNewsletterMedia = (media, type = 'image', excludedUrls = new Set()) => {
    const eligible = media.filter((item) => type === 'gif' ? item.isGif : !item.isGif);
    const landscape = type === 'image' ? eligible.filter((item) => item.isLandscape) : eligible;
    const preferred = landscape.length ? landscape : eligible;
    const unused = preferred.filter((item) => !excludedUrls.has(item.publicUrl));
    const pool = unused.length ? unused : preferred;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};
