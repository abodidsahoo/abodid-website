// Blog block schema — mirrors PortfolioBlockEditor/schema patterns
// but scoped to writing/article content only.

export const BLOG_BLOCK_TYPES = [
    'body_text',
    'heading',
    'quotation',
    'divider',
    'single_image',
    'video_embed',
    'two_columns',
    'highlight',
];

export const BLOG_BLOCK_LABELS = {
    body_text: 'Body text',
    heading: 'Heading',
    quotation: 'Quotation',
    divider: 'Divider',
    single_image: 'Image',
    video_embed: 'Video',
    two_columns: 'Two columns',
    highlight: 'Callout',
};

export const BLOG_BLOCK_DESCRIPTIONS = {
    body_text: 'Paragraph text with Markdown support.',
    heading: 'Section heading (H2 or H3).',
    quotation: 'Pull quote with optional attribution.',
    divider: 'Horizontal rule to separate sections.',
    single_image: 'A single image with caption and alt text.',
    video_embed: 'Embed a YouTube or Vimeo video.',
    two_columns: 'Side-by-side text columns.',
    highlight: 'Callout or highlighted statement.',
};

export function getBlogBlockSummary(block) {
    const c = block.content || {};
    switch (block.blockType) {
        case 'body_text': return (c.text || '').slice(0, 60) || 'No text yet';
        case 'heading': return c.text || 'No heading yet';
        case 'quotation': return (c.quote || '').slice(0, 60) || 'No quote yet';
        case 'single_image': return c.media?.url ? 'Image set' : 'No image yet';
        case 'video_embed': return c.url || 'No URL yet';
        case 'two_columns': return 'Two-column layout';
        case 'highlight': return (c.text || '').slice(0, 60) || 'No callout text';
        case 'divider': return '―――';
        default: return '';
    }
}

export function createBlogBlock(blockType) {
    const id = crypto.randomUUID();
    const base = { id, blockType, settings: { width: 'standard', spacing: 'default' } };
    switch (blockType) {
        case 'body_text': return { ...base, content: { text: '' } };
        case 'heading': return { ...base, content: { text: '', level: 2 } };
        case 'quotation': return { ...base, content: { quote: '', attribution: '' } };
        case 'divider': return { ...base, content: {} };
        case 'single_image': return { ...base, content: { media: null } };
        case 'video_embed': return { ...base, content: { url: '', caption: '' } };
        case 'two_columns': return { ...base, content: { leftText: '', rightText: '' } };
        case 'highlight': return { ...base, content: { text: '' } };
        default: return { ...base, content: {} };
    }
}
