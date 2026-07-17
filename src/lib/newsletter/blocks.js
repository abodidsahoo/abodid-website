export const NEWSLETTER_DOCUMENT_VERSION = 1;

export const NEWSLETTER_BLOCK_TYPES = [
    { type: 'headingGroup', label: 'Heading + Sub', description: 'A paired title and supporting line' },
    { type: 'heading', label: 'Heading', description: 'A title or section heading' },
    { type: 'subheading', label: 'Subheading', description: 'A smaller secondary heading' },
    { type: 'smallText', label: 'Short text', description: 'A concise body-text passage' },
    { type: 'text', label: 'Paragraph', description: 'A longer paragraph with precise typography' },
    { type: 'link', label: 'Link', description: 'A clean line of clickable linked text' },
    { type: 'image', label: 'Image', description: 'A resizable image with square or rounded corners' },
    { type: 'gif', label: 'GIF', description: 'An animated image selected from the mood board' },
    { type: 'button', label: 'Button', description: 'A clear call to action' },
    { type: 'divider', label: 'Divider', description: 'A horizontal separator' },
    { type: 'spacer', label: 'Spacer', description: 'Adjustable blank space with an optional colour' },
    { type: 'columns', label: 'Columns', description: 'Two or three mobile-stacking columns' },
    { type: 'footer', label: 'Footer', description: 'Branded sign-off and unsubscribe link' },
];

export const NEWSLETTER_FONT_OPTIONS = Object.freeze([
    {
        value: 'satoshi',
        label: 'Satoshi — Brand',
        family: "'Satoshi', 'Helvetica Neue', Arial, sans-serif",
        msoFamily: 'Arial, sans-serif',
        webFont: true,
    },
    {
        value: 'arial',
        label: 'Arial / Helvetica — Sans serif',
        family: "Arial, Helvetica, sans-serif",
        msoFamily: 'Arial, sans-serif',
        webFont: false,
    },
    {
        value: 'verdana',
        label: 'Verdana / Tahoma — Sans serif',
        family: 'Verdana, Tahoma, sans-serif',
        msoFamily: 'Verdana, sans-serif',
        webFont: false,
    },
    {
        value: 'georgia',
        label: 'Georgia / Times — Serif',
        family: "Georgia, 'Times New Roman', Times, serif",
        msoFamily: "Georgia, 'Times New Roman', serif",
        webFont: false,
    },
    {
        value: 'courier',
        label: 'Courier New — Monospace',
        family: "'Courier New', Courier, monospace",
        msoFamily: "'Courier New', Courier, monospace",
        webFont: false,
    },
]);

export const getNewsletterFontOption = (value) => NEWSLETTER_FONT_OPTIONS.find((option) => option.value === value)
    || NEWSLETTER_FONT_OPTIONS[0];

export const DEFAULT_NEWSLETTER_SETTINGS = Object.freeze({
    version: NEWSLETTER_DOCUMENT_VERSION,
    canvasWidth: 640,
    outerBackgroundColor: '#f3f2ef',
    canvasBackgroundColor: '#ffffff',
    headingFont: 'satoshi',
    bodyFont: 'satoshi',
    // Kept for drafts created before heading/body font choices were separated.
    fontFamily: "'Satoshi', 'Helvetica Neue', Arial, sans-serif",
});

export const DEFAULT_NEWSLETTER_BODY_TEXT = `I help people use stories to communicate, educate and bring communities together.

As a creative director, artist, and researcher, I enjoy pushing the boundaries of storytelling, turning it into memorable, participatory "experiences" that spark conversations and help build deeper connections.

From art installations and exhibitions to films and digital experiences, I create research-driven work that is intuitive and accessible. As a creative consultant, I work with exhibition design teams, design studios, and corporate clients, leading the creative direction and early-stage concept ideation for research-driven storytelling products of the future.

Sometimes I work as a super connector, mapping a brand's complex ecosystem and emerging ideas with brilliant creative minds across the globe.`;

export const DEFAULT_NEWSLETTER_SMALL_TEXT = 'As a creative director, artist, and researcher, I enjoy pushing the boundaries of storytelling, turning it into memorable, participatory "experiences" that spark conversations and help build deeper connections.';
export const DEFAULT_NEWSLETTER_INTRO_TEXT = DEFAULT_NEWSLETTER_SMALL_TEXT;
export const DEFAULT_NEWSLETTER_HEADING_TEXT = 'Best possible heading';
export const DEFAULT_NEWSLETTER_SUBHEADING_TEXT = 'an absolutely mindblowing subheading';

export const DEFAULT_NEWSLETTER_LINK_TEXT = 'Download the Obsidian 101 Guide';
export const DEFAULT_NEWSLETTER_LINK_URL = 'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/cv/Abodid-Sahoo-2026-CV.pdf?download=Abodid%20Sahoo%20-%202026%20CV.pdf';

const createDefaultNewsletterBodyLinks = () => [
    { text: 'exhibition design teams', url: 'https://abodid.com/services' },
    { text: 'super connector', url: 'https://abodid.com/services' },
].map(({ text, url }) => {
    const start = DEFAULT_NEWSLETTER_BODY_TEXT.indexOf(text);
    return { start, end: start + text.length, url };
});

const makeId = (prefix) => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const NEWSLETTER_COLUMN_ITEM_TYPES = Object.freeze([
    { type: 'heading', label: 'Heading' },
    { type: 'text', label: 'Text' },
    { type: 'image', label: 'Image' },
    { type: 'button', label: 'Button' },
    { type: 'link', label: 'Link' },
]);

export const createNewsletterColumnItem = (type, overrides = {}) => {
    const shared = { id: makeId(`column-${type}`), type, spacingBottom: 12 };
    let item;

    switch (type) {
        case 'heading':
            item = { ...shared, text: 'A new heading', font: 'satoshi', fontSize: 20, fontWeight: 700, color: '#222222', align: 'left' };
            break;
        case 'text':
            item = { ...shared, text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', font: 'satoshi', fontSize: 15, fontWeight: 400, lineHeight: 1.55, color: '#222222', align: 'left' };
            break;
        case 'image':
            item = { ...shared, imageUrl: '', previewImageUrl: '', previewImageAlt: '', previewSource: 'moodboard', alt: '', caption: '', linkUrl: '', widthPercent: 100, frameHeight: 150, align: 'center', rounded: false };
            break;
        case 'button':
            item = { ...shared, label: 'Read more', url: '', buttonColor: '#000000', textColor: '#ffffff', fontSize: 14, fontWeight: 700, align: 'left', rounded: true };
            break;
        case 'link':
            item = { ...shared, text: 'Read more', url: '', font: 'satoshi', color: '#2457d6', fontSize: 14, fontWeight: 600, align: 'left', underline: true };
            break;
        default:
            throw new Error(`Unsupported newsletter column item type: ${type}`);
    }

    return { ...item, ...overrides, id: overrides.id || item.id, type };
};

const DEFAULT_NEWSLETTER_COLUMN_COPY = [
    {
        heading: 'Stories that connect people',
        text: 'Stories can communicate ideas, educate and bring people together.',
    },
    {
        heading: 'Research-driven creative work',
        text: 'Research helps me create work that feels intuitive and accessible.',
    },
    {
        heading: 'Creative connections worldwide',
        text: 'I connect complex ideas with brilliant creative minds across the globe.',
    },
];

export const createNewsletterColumn = (index = 0) => {
    const copy = DEFAULT_NEWSLETTER_COLUMN_COPY[index] || DEFAULT_NEWSLETTER_COLUMN_COPY[0];
    return {
        id: makeId('column'),
        items: [
            createNewsletterColumnItem('image'),
            createNewsletterColumnItem('heading', { text: copy.heading, fontSize: 16 }),
            createNewsletterColumnItem('text', { text: copy.text, fontSize: 15 }),
        ],
    };
};

export const getNewsletterColumnItems = (column = {}) => {
    if (Array.isArray(column.items)) return column.items;

    const items = [];
    if (column.imageUrl) items.push(createNewsletterColumnItem('image', {
        imageUrl: column.imageUrl,
        alt: column.alt || '',
    }));
    if (column.heading) items.push(createNewsletterColumnItem('heading', { text: column.heading }));
    if (column.text) items.push(createNewsletterColumnItem('text', { text: column.text }));
    return items;
};

const baseBlock = (type) => ({
    id: makeId(type),
    type,
    backgroundColor: null,
    paddingTop: 20,
    paddingRight: 40,
    paddingBottom: 20,
    paddingLeft: 40,
});

export const createNewsletterBlock = (type, overrides = {}) => {
    let block;

    switch (type) {
        case 'headingGroup':
            block = {
                ...baseBlock(type),
                backgroundColor: '#000000',
                headingText: DEFAULT_NEWSLETTER_HEADING_TEXT,
                subheadingText: DEFAULT_NEWSLETTER_SUBHEADING_TEXT,
                headingFont: 'satoshi',
                subheadingFont: 'satoshi',
                headingFontSize: 34,
                headingFontWeight: 700,
                headingColor: '#ffffff',
                headingLineHeight: 1.2,
                subheadingFontSize: 16,
                subheadingFontWeight: 500,
                subheadingColor: '#ffffff',
                subheadingLineHeight: 1.45,
                align: 'left',
                paddingTop: 32,
                paddingBottom: 24,
            };
            break;
        case 'heading':
            block = {
                ...baseBlock(type),
                backgroundColor: '#000000',
                text: DEFAULT_NEWSLETTER_HEADING_TEXT,
                font: 'satoshi',
                fontSize: 34,
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#ffffff',
                align: 'left',
                paddingTop: 32,
                paddingBottom: 12,
            };
            break;
        case 'subheading':
            block = {
                ...baseBlock(type),
                backgroundColor: '#ffffff',
                text: DEFAULT_NEWSLETTER_SUBHEADING_TEXT,
                font: 'satoshi',
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.4,
                color: '#222222',
                align: 'left',
                paddingTop: 24,
                paddingBottom: 16,
            };
            break;
        case 'smallText':
            block = {
                ...baseBlock(type),
                text: DEFAULT_NEWSLETTER_SMALL_TEXT,
                font: 'satoshi',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#222222',
                align: 'left',
                backgroundColor: '#ffffff',
                paddingTop: 8,
                paddingBottom: 16,
            };
            break;
        case 'text':
            block = {
                ...baseBlock(type),
                text: DEFAULT_NEWSLETTER_BODY_TEXT,
                font: 'satoshi',
                links: createDefaultNewsletterBodyLinks(),
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#222222',
                linkColor: '#2457d6',
                linkFontWeight: 600,
                linkFontStyle: 'normal',
                linkUnderline: true,
                align: 'left',
                backgroundColor: '#ffffff',
                paddingTop: 12,
                paddingBottom: 24,
            };
            break;
        case 'link':
            block = {
                ...baseBlock(type),
                text: DEFAULT_NEWSLETTER_LINK_TEXT,
                url: DEFAULT_NEWSLETTER_LINK_URL,
                font: 'satoshi',
                fontSize: 16,
                fontWeight: 600,
                fontStyle: 'normal',
                lineHeight: 1.5,
                color: '#2457d6',
                underline: true,
                align: 'left',
                backgroundColor: '#ffffff',
                paddingTop: 12,
                paddingBottom: 12,
            };
            break;
        case 'image':
            block = {
                ...baseBlock(type),
                imageUrl: '',
                previewImageUrl: '',
                previewImageAlt: '',
                previewSource: 'moodboard',
                alt: '',
                caption: '',
                linkUrl: '',
                widthPercent: 100,
                align: 'center',
                rounded: false,
                paddingTop: 16,
                paddingBottom: 16,
            };
            break;
        case 'gif':
            block = {
                ...baseBlock(type),
                imageUrl: '',
                previewImageUrl: '',
                previewImageAlt: '',
                previewSource: 'moodboardGif',
                alt: '',
                caption: '',
                linkUrl: '',
                widthPercent: 100,
                align: 'center',
                rounded: false,
                paddingTop: 16,
                paddingBottom: 16,
            };
            break;
        case 'button':
            block = {
                ...baseBlock(type),
                label: 'Read more',
                url: '',
                buttonColor: '#000000',
                textColor: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                align: 'left',
                rounded: true,
            };
            break;
        case 'divider':
            block = {
                ...baseBlock(type),
                color: '#333333',
                thickness: 1,
                paddingTop: 16,
                paddingBottom: 16,
            };
            break;
        case 'spacer':
            block = {
                ...baseBlock(type),
                height: 32,
                backgroundColor: null,
                paddingTop: 0,
                paddingRight: 0,
                paddingBottom: 0,
                paddingLeft: 0,
            };
            break;
        case 'columns':
            block = {
                ...baseBlock(type),
                columnCount: 2,
                gap: 20,
                headingFontSize: 20,
                headingFontWeight: 700,
                textFontSize: 15,
                textFontWeight: 400,
                headingColor: '#222222',
                textColor: '#222222',
                imageRounded: false,
                columns: [
                    createNewsletterColumn(0),
                    createNewsletterColumn(1),
                ],
            };
            break;
        case 'footer':
            block = {
                ...baseBlock(type),
                brandName: 'Abodid Sahoo',
                message: 'You received this newsletter because you have subscribed to receive updates from Abodid Sahoo or you may be connected with him personally or via LinkedIn/Instagram.',
                font: 'satoshi',
                websiteLabel: 'Visit my Website',
                websiteUrl: 'https://abodid.com',
                fontSize: 12,
                fontWeight: 400,
                color: '#333333',
                linkColor: '#a30021',
                backgroundColor: '#ffffff',
                align: 'center',
                paddingTop: 28,
                paddingBottom: 28,
            };
            break;
        default:
            throw new Error(`Unsupported newsletter block type: ${type}`);
    }

    return { ...block, ...overrides, id: overrides.id || block.id, type };
};

export const createDefaultNewsletterBlocks = () => [
    createNewsletterBlock('headingGroup'),
    createNewsletterBlock('smallText', { text: DEFAULT_NEWSLETTER_INTRO_TEXT, paddingTop: 32 }),
    createNewsletterBlock('image'),
    createNewsletterBlock('text'),
    createNewsletterBlock('divider'),
    createNewsletterBlock('subheading'),
    createNewsletterBlock('smallText'),
    createNewsletterBlock('columns'),
    createNewsletterBlock('link'),
    createNewsletterBlock('button'),
    createNewsletterBlock('footer'),
];

export const createDefaultNewsletterDocument = () => ({
    version: NEWSLETTER_DOCUMENT_VERSION,
    settings: { ...DEFAULT_NEWSLETTER_SETTINGS },
    blocks: createDefaultNewsletterBlocks(),
});

export const cloneNewsletterBlock = (block) => ({
    ...structuredClone(block),
    id: makeId(block.type || 'block'),
    columns: Array.isArray(block.columns)
        ? block.columns.map((column) => ({
            ...column,
            id: makeId('column'),
            items: getNewsletterColumnItems(column).map((item) => ({ ...item, id: makeId(`column-${item.type}`) })),
        }))
        : block.columns,
});

export const resizeNewsletterColumns = (block, count) => {
    const nextCount = count === 3 ? 3 : 2;
    const existingColumns = Array.isArray(block.columns) ? block.columns : [];
    const columns = Array.from({ length: nextCount }, (_, index) => existingColumns[index]
        ? { ...existingColumns[index], items: getNewsletterColumnItems(existingColumns[index]) }
        : createNewsletterColumn(index));

    return { ...block, columnCount: nextCount, columns };
};

export const newsletterHasContent = (blocks) => Array.isArray(blocks) && blocks.some((block) => {
    if (block?.type === 'headingGroup') return Boolean(block.headingText?.trim() || block.subheadingText?.trim());
    if (block?.type === 'heading' || block?.type === 'subheading' || block?.type === 'smallText' || block?.type === 'text') return Boolean(block.text?.trim());
    if (block?.type === 'link') return Boolean(block.text?.trim() && block.url?.trim());
    if (block?.type === 'image' || block?.type === 'gif') return Boolean(block.imageUrl?.trim());
    if (block?.type === 'button') return Boolean(block.label?.trim() && block.url?.trim());
    if (block?.type === 'columns') return block.columns?.some((column) => getNewsletterColumnItems(column).some((item) => {
        if (item.type === 'heading' || item.type === 'text') return Boolean(item.text?.trim());
        if (item.type === 'image') return Boolean(item.imageUrl?.trim());
        if (item.type === 'button') return Boolean(item.label?.trim() && item.url?.trim());
        if (item.type === 'link') return Boolean(item.text?.trim() && item.url?.trim());
        return false;
    }));
    return false;
});
