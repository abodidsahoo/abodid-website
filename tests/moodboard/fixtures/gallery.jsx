import React from 'react';
import { createRoot } from 'react-dom/client';
import MoodboardGallery from '../../../src/components/MoodboardGallery.jsx';

const imageUrls = Array.from({ length: 80 }, (_, index) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${80 + index}" height="100"><rect width="100%" height="100%" fill="#ef233c"/></svg>`)}`);
const items = Array.from({ length: 1440 }, (_, index) => ({
    id: `photo-${index}`,
    title: `Reference ${index}`,
    tags: [index % 2 ? 'Architecture' : 'Portrait'],
    artistName: index % 2 ? 'Mira' : 'Anu',
    imageUrl: imageUrls[index % imageUrls.length],
    thumbnailUrl: imageUrls[index % imageUrls.length],
    paletteImageUrl: imageUrls[index % imageUrls.length],
    palette: { dominantHex: '#ef233c', dominantLab: [51.48, 72.83, 42.55], paletteLab: [[51.48, 72.83, 42.55]] },
}));

// Warm the browser's image cache before mounting, as happens on repeat searches.
await Promise.all(imageUrls.map(async (url) => {
    const cachedImage = new Image();
    cachedImage.src = url;
    await cachedImage.decode();
}));
createRoot(document.getElementById('root')).render(<MoodboardGallery items={items} />);
