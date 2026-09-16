import fs from 'node:fs';
import path from 'node:path';

export const POP_THEMES = {
    yellow: {
        name: 'yellow',
        bg: '#ffe44f',
        text: '#15130f',
        subtext: '#2d281e',
        border: '#15130f',
        badgeBg: '#ffffff',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#ffe44f',
        subtitleBg: 'rgba(255, 255, 255, 0.94)',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffffff',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
    blue: {
        name: 'blue',
        bg: '#2444ca',
        text: '#ffffff',
        subtext: '#e8f0fe',
        border: '#ffffff',
        badgeBg: '#ffe44f',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#2444ca',
        subtitleBg: 'rgba(255, 255, 255, 0.18)',
        subtitleBorder: 'rgba(255, 255, 255, 0.5)',
        subtitleText: '#ffffff',
        footerBg: '#ffe44f',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
    purple: {
        name: 'purple',
        bg: '#5524c7',
        text: '#ffffff',
        subtext: '#f5eeff',
        border: '#ffffff',
        badgeBg: '#ffe44f',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#5524c7',
        subtitleBg: 'rgba(255, 255, 255, 0.18)',
        subtitleBorder: 'rgba(255, 255, 255, 0.5)',
        subtitleText: '#ffffff',
        footerBg: '#ffe44f',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
    lime: {
        name: 'lime',
        bg: '#caff48',
        text: '#15130f',
        subtext: '#222d14',
        border: '#15130f',
        badgeBg: '#ffffff',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#5524c7',
        subtitleBg: 'rgba(255, 255, 255, 0.94)',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffffff',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#5524c7',
    },
    pink: {
        name: 'pink',
        bg: '#ff7eb5',
        text: '#15130f',
        subtext: '#2f1822',
        border: '#15130f',
        badgeBg: '#ffffff',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#2444ca',
        subtitleBg: 'rgba(255, 255, 255, 0.94)',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffffff',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#2444ca',
    },
    cyan: {
        name: 'cyan',
        bg: '#62e6ff',
        text: '#15130f',
        subtext: '#122c33',
        border: '#15130f',
        badgeBg: '#ffffff',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#5524c7',
        subtitleBg: 'rgba(255, 255, 255, 0.94)',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffffff',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#5524c7',
    },
    orange: {
        name: 'orange',
        bg: '#ff875c',
        text: '#15130f',
        subtext: '#2f1b14',
        border: '#15130f',
        badgeBg: '#ffffff',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#15130f',
        subtitleBg: 'rgba(255, 255, 255, 0.94)',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffffff',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
    cream: {
        name: 'cream',
        bg: '#fff8e8',
        text: '#15130f',
        subtext: '#3c3529',
        border: '#15130f',
        badgeBg: '#ffe44f',
        badgeText: '#15130f',
        badgeBorder: '#15130f',
        badgeDot: '#2444ca',
        subtitleBg: '#ffffff',
        subtitleBorder: '#15130f',
        subtitleText: '#15130f',
        footerBg: '#ffe44f',
        footerBorder: '#15130f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
    dark: {
        name: 'dark',
        bg: '#15130f',
        text: '#ffffff',
        subtext: '#e2e2e2',
        border: '#ffe44f',
        badgeBg: '#ffe44f',
        badgeText: '#15130f',
        badgeBorder: '#ffe44f',
        badgeDot: '#15130f',
        subtitleBg: 'rgba(255, 255, 255, 0.12)',
        subtitleBorder: 'rgba(255, 255, 255, 0.3)',
        subtitleText: '#ffffff',
        footerBg: '#ffe44f',
        footerBorder: '#ffe44f',
        footerText: '#15130f',
        accent: '#ffe44f',
    },
};

const THEME_CYCLE_KEYS = [
    'yellow',
    'blue',
    'lime',
    'purple',
    'pink',
    'cyan',
    'orange',
    'cream',
];

let satoshiFontBuffers = null;

export function loadSatoshiFonts() {
    if (satoshiFontBuffers) return satoshiFontBuffers;

    try {
        const baseDir = path.resolve(process.cwd(), 'public/fonts/satoshi');
        const blackPath = path.join(baseDir, 'Satoshi-Black.ttf');
        const boldPath = path.join(baseDir, 'Satoshi-Bold.ttf');
        const medPath = path.join(baseDir, 'Satoshi-Medium.ttf');

        if (fs.existsSync(blackPath) && fs.existsSync(boldPath) && fs.existsSync(medPath)) {
            const blackBuf = fs.readFileSync(blackPath);
            const boldBuf = fs.readFileSync(boldPath);
            const medBuf = fs.readFileSync(medPath);

            const toArrayBuffer = (b) =>
                b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

            satoshiFontBuffers = [
                { name: 'Satoshi', data: toArrayBuffer(blackBuf), weight: 900, style: 'normal' },
                { name: 'Satoshi', data: toArrayBuffer(boldBuf), weight: 700, style: 'normal' },
                { name: 'Satoshi', data: toArrayBuffer(medBuf), weight: 500, style: 'normal' },
            ];
            return satoshiFontBuffers;
        }
    } catch (error) {
        console.warn('[og-helper] Font file loading fallback:', error);
    }
    return undefined;
}

export function cleanTitleText(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return 'Abodid Sahoo';

    let cleaned = rawTitle
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Strip trailing site/author suffix patterns
    cleaned = cleaned
        .replace(/\s*\|\s*Abodid\s*Sahoo$/i, '')
        .replace(/\s*•\s*Abodid\s*Sahoo$/i, '')
        .replace(/\s*-\s*Abodid\s*Sahoo$/i, '')
        .replace(/\s*—\s*Abodid\s*Sahoo$/i, '')
        .replace(/\s*\|\s*Portfolio$/i, '')
        .trim();

    if (!cleaned) return 'Abodid Sahoo';
    return cleaned;
}

export function detectCategory(title, categoryHint) {
    if (categoryHint && typeof categoryHint === 'string' && categoryHint.trim()) {
        return categoryHint.trim().toUpperCase();
    }

    const lower = (title || '').toLowerCase();

    if (
        lower.includes('vault') ||
        lower.includes('obsidian') ||
        lower.includes('second brain') ||
        lower.includes('digest')
    ) {
        return 'OBSIDIAN VAULT';
    }
    if (
        lower.includes('workshop') ||
        lower.includes('teaching') ||
        lower.includes('tutor') ||
        lower.includes('masterclass') ||
        lower.includes('class')
    ) {
        return 'WORKSHOPS';
    }
    if (
        lower.includes('opportunit') ||
        lower.includes('radar') ||
        lower.includes('grant') ||
        lower.includes('residen') ||
        lower.includes('fellowship') ||
        lower.includes('open call')
    ) {
        return 'OPPORTUNITIES';
    }
    if (
        lower.includes('photo') ||
        lower.includes('gallery') ||
        lower.includes('portrait') ||
        lower.includes('exhibition')
    ) {
        return 'PHOTOGRAPHY';
    }
    if (
        lower.includes('film') ||
        lower.includes('cinema') ||
        lower.includes('supercut') ||
        lower.includes('video') ||
        lower.includes('movie')
    ) {
        return 'CINEMA & FILM';
    }
    if (
        lower.includes('punctum') ||
        lower.includes('lab') ||
        lower.includes('experiment') ||
        lower.includes('toolkit') ||
        /\bai\b/i.test(lower) ||
        lower.includes('artificial intelligence') ||
        lower.includes('research') ||
        lower.includes('neuro-symbolic')
    ) {
        return 'LAB & RESEARCH';
    }
    if (
        lower.includes('architect') ||
        lower.includes('system') ||
        lower.includes('tech stack')
    ) {
        return 'ARCHITECTURE';
    }
    if (
        lower.includes('blog') ||
        lower.includes('essay') ||
        lower.includes('story') ||
        lower.includes('journal') ||
        lower.includes('reflection')
    ) {
        return 'ESSAYS & JOURNAL';
    }
    if (
        lower.includes('about') ||
        lower.includes('contact') ||
        lower.includes('bio') ||
        lower.includes('press')
    ) {
        return 'PORTFOLIO';
    }

    return 'CREATIVE TECH & ART';
}

export function resolveTheme(title, category, explicitTheme) {
    if (explicitTheme && typeof explicitTheme === 'string' && POP_THEMES[explicitTheme.toLowerCase()]) {
        return POP_THEMES[explicitTheme.toLowerCase()];
    }

    switch (category) {
        case 'OPPORTUNITIES':
            return POP_THEMES.yellow;
        case 'PHOTOGRAPHY':
            return POP_THEMES.yellow;
        case 'CINEMA & FILM':
            return POP_THEMES.purple;
        case 'LAB & RESEARCH':
            return POP_THEMES.lime;
        case 'OBSIDIAN VAULT':
            return POP_THEMES.cream;
        case 'ARCHITECTURE':
            return POP_THEMES.blue;
        case 'WORKSHOPS':
            return POP_THEMES.cyan;
        case 'ESSAYS & JOURNAL':
            return POP_THEMES.pink;
        default:
            break;
    }

    let hash = 0;
    const safeTitle = title || '';
    for (let i = 0; i < safeTitle.length; i++) {
        hash = (hash << 5) - hash + safeTitle.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % THEME_CYCLE_KEYS.length;
    return POP_THEMES[THEME_CYCLE_KEYS[index]];
}

export function cleanSubtitleText(rawDesc, cleanTitle) {
    if (!rawDesc || typeof rawDesc !== 'string') return undefined;

    let desc = rawDesc
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!desc) return undefined;

    if (cleanTitle && desc.toLowerCase() === cleanTitle.toLowerCase()) {
        return undefined;
    }

    if (desc.length > 140) {
        const truncated = desc.slice(0, 137);
        const lastSpace = truncated.lastIndexOf(' ');
        desc = (lastSpace > 90 ? truncated.slice(0, lastSpace) : truncated) + '...';
    }

    return desc;
}

export function getTitleFontSize(length) {
    if (length <= 20) return { fontSize: 78, lineHeight: 1.04 };
    if (length <= 36) return { fontSize: 66, lineHeight: 1.08 };
    if (length <= 55) return { fontSize: 54, lineHeight: 1.12 };
    return { fontSize: 46, lineHeight: 1.16 };
}
