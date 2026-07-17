import {
    createNewsletterBlock,
    DEFAULT_NEWSLETTER_SETTINGS,
    getNewsletterColumnItems,
    getNewsletterFontOption,
    NEWSLETTER_FONT_OPTIONS,
} from './blocks.js';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const FONT_WEIGHTS = new Set([400, 500, 600, 700, 800]);

export const escapeNewsletterHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const clamp = (value, minimum, maximum, fallback) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.min(maximum, Math.max(minimum, numericValue));
};

const safeColor = (value, fallback) => HEX_COLOR_PATTERN.test(String(value || ''))
    ? String(value)
    : fallback;

const safeAlign = (value) => ALIGNMENTS.has(value) ? value : 'left';
const safeFontWeight = (value, fallback = 400) => FONT_WEIGHTS.has(Number(value)) ? Number(value) : fallback;
const resolveNewsletterFont = (value, fallback) => getNewsletterFontOption(value || fallback);
const newsletterFontClass = (font) => `email-font-${font.value}`;

const safeUrl = (value, { allowMergeTag = false } = {}) => {
    const normalized = String(value || '').trim();
    if (allowMergeTag && normalized === '{{unsubscribe_url}}') return normalized;
    if (!normalized) return '';

    try {
        const parsed = new URL(normalized);
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
        return escapeNewsletterHtml(parsed.toString());
    } catch {
        return '';
    }
};

const safeHttpsUrl = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';

    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'https:' ? escapeNewsletterHtml(parsed.toString()) : '';
    } catch {
        return '';
    }
};

const textWithBreaks = (value) => escapeNewsletterHtml(value).replace(/\r?\n/g, '<br />');

const renderInlineText = (value, links, {
    linkColor,
    linkFontFamily,
    linkFontWeight,
    linkFontStyle,
    linkUnderline,
}) => {
    const text = String(value || '');
    const normalizedLinks = (Array.isArray(links) ? links : [])
        .map((link) => ({
            start: Number(link?.start),
            end: Number(link?.end),
            href: safeHttpsUrl(link?.url),
        }))
        .filter((link) => Number.isInteger(link.start)
            && Number.isInteger(link.end)
            && link.start >= 0
            && link.end > link.start
            && link.end <= text.length
            && link.href)
        .sort((first, second) => first.start - second.start || first.end - second.end);

    let cursor = 0;
    let html = '';
    normalizedLinks.forEach((link) => {
        if (link.start < cursor) return;
        html += textWithBreaks(text.slice(cursor, link.start));
        html += `<a class="email-body-font" href="${link.href}" target="_blank" style="${pinnedText(linkColor)}font-family:${linkFontFamily};font-size:inherit;font-style:${linkFontStyle};font-weight:${linkFontWeight};text-decoration:${linkUnderline ? 'underline' : 'none'};">${textWithBreaks(text.slice(link.start, link.end))}</a>`;
        cursor = link.end;
    });

    return html + textWithBreaks(text.slice(cursor));
};

export const normalizeNewsletterSettings = (settings = {}) => {
    const headingFont = getNewsletterFontOption(settings.headingFont || DEFAULT_NEWSLETTER_SETTINGS.headingFont);
    const bodyFont = getNewsletterFontOption(settings.bodyFont || DEFAULT_NEWSLETTER_SETTINGS.bodyFont);

    return {
        ...DEFAULT_NEWSLETTER_SETTINGS,
        ...settings,
        canvasWidth: Math.round(clamp(settings.canvasWidth, 600, 680, DEFAULT_NEWSLETTER_SETTINGS.canvasWidth)),
        outerBackgroundColor: safeColor(settings.outerBackgroundColor, DEFAULT_NEWSLETTER_SETTINGS.outerBackgroundColor),
        canvasBackgroundColor: DEFAULT_NEWSLETTER_SETTINGS.canvasBackgroundColor,
        headingFont: headingFont.value,
        bodyFont: bodyFont.value,
        headingFontFamily: headingFont.family,
        bodyFontFamily: bodyFont.family,
        headingMsoFontFamily: headingFont.msoFamily,
        bodyMsoFontFamily: bodyFont.msoFamily,
        // Preserve the legacy property as the effective body stack for older callers.
        fontFamily: bodyFont.family,
    };
};

const SATOSHI_FONT_BASE_URL = 'https://abodid.com/fonts/satoshi';

const renderWebFontCss = (settings, blocks = []) => {
    const blocksUseSatoshi = blocks.some((block) => block?.font === 'satoshi'
        || block?.headingFont === 'satoshi'
        || block?.subheadingFont === 'satoshi'
        || block?.columns?.some((column) => getNewsletterColumnItems(column).some((item) => item.font === 'satoshi')));
    if (settings.headingFont !== 'satoshi' && settings.bodyFont !== 'satoshi' && !blocksUseSatoshi) return '';

    return `
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:400; src:url('${SATOSHI_FONT_BASE_URL}/Satoshi-Regular.woff2') format('woff2'), url('${SATOSHI_FONT_BASE_URL}/Satoshi-Regular.woff') format('woff'); }
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:500; src:url('${SATOSHI_FONT_BASE_URL}/Satoshi-Medium.woff2') format('woff2'), url('${SATOSHI_FONT_BASE_URL}/Satoshi-Medium.woff') format('woff'); }
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:700; src:url('${SATOSHI_FONT_BASE_URL}/Satoshi-Bold.woff2') format('woff2'), url('${SATOSHI_FONT_BASE_URL}/Satoshi-Bold.woff') format('woff'); }
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:900; src:url('${SATOSHI_FONT_BASE_URL}/Satoshi-Black.woff2') format('woff2'), url('${SATOSHI_FONT_BASE_URL}/Satoshi-Black.woff') format('woff'); }`;
};

const sectionBackground = (block, settings) => safeColor(block?.backgroundColor, settings.canvasBackgroundColor);
const pinnedBackground = (color) => `background-color:${color};background-image:linear-gradient(${color},${color});`;
const pinnedText = (color) => `color:${color};-webkit-text-fill-color:${color};`;

const sectionTable = (block, settings, content, extraCellStyle = '') => {
    const backgroundColor = sectionBackground(block, settings);
    const paddingTop = Math.round(clamp(block.paddingTop, 0, 96, 20));
    const paddingRight = Math.round(clamp(block.paddingRight, 0, 72, 40));
    const paddingBottom = Math.round(clamp(block.paddingBottom, 0, 96, 20));
    const paddingLeft = Math.round(clamp(block.paddingLeft, 0, 72, 40));

    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${backgroundColor}" style="width:100%;border-collapse:collapse;${pinnedBackground(backgroundColor)}">
  <tr>
    <td class="mobile-section-padding" bgcolor="${backgroundColor}" style="padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;${pinnedBackground(backgroundColor)}${extraCellStyle}">
      ${content}
    </td>
  </tr>
</table>`.trim();
};

const renderHeadingGroup = (block, settings) => {
    const headingText = String(block.headingText || '').trim();
    const subheadingText = String(block.subheadingText || '').trim();
    if (!headingText && !subheadingText) return '';

    const align = safeAlign(block.align);
    const headingFontSize = Math.round(clamp(block.headingFontSize, 12, 72, 34));
    const headingFontWeight = safeFontWeight(block.headingFontWeight, 700);
    const headingColor = safeColor(block.headingColor, '#ffffff');
    const headingLineHeight = clamp(block.headingLineHeight, 1, 2.2, 1.2);
    const subheadingFontSize = Math.round(clamp(block.subheadingFontSize, 10, 48, 16));
    const subheadingFontWeight = safeFontWeight(block.subheadingFontWeight, 500);
    const subheadingColor = safeColor(block.subheadingColor, '#ffffff');
    const subheadingLineHeight = clamp(block.subheadingLineHeight, 1, 2.2, 1.45);
    const headingFont = resolveNewsletterFont(block.headingFont, settings.headingFont);
    const subheadingFont = resolveNewsletterFont(block.subheadingFont, settings.headingFont);

    const heading = headingText
        ? `<h1 class="email-heading-font ${newsletterFontClass(headingFont)}" style="margin:0 0 ${subheadingText ? 8 : 0}px;${pinnedText(headingColor)}font-family:${headingFont.family};font-size:${headingFontSize}px;font-weight:${headingFontWeight};line-height:${headingLineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(block.headingText)}</h1>`
        : '';
    const subheading = subheadingText
        ? `<h2 class="email-heading-font ${newsletterFontClass(subheadingFont)}" style="margin:0;${pinnedText(subheadingColor)}font-family:${subheadingFont.family};font-size:${subheadingFontSize}px;font-weight:${subheadingFontWeight};line-height:${subheadingLineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(block.subheadingText)}</h2>`
        : '';

    return sectionTable(block, settings, `${heading}${subheading}`);
};

const renderHeading = (block, settings) => {
    if (!String(block.text || '').trim()) return '';
    const fontSize = Math.round(clamp(block.fontSize, 12, 72, 34));
    const lineHeight = clamp(block.lineHeight, 1, 2.2, 1.2);
    const color = safeColor(block.color, '#ffffff');
    const align = safeAlign(block.align);
    const fontWeight = safeFontWeight(block.fontWeight, 700);
    const font = resolveNewsletterFont(block.font, settings.headingFont);

    return sectionTable(block, settings, `
<h1 class="email-heading-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(block.text)}</h1>`.trim());
};

const renderSubheading = (block, settings) => {
    if (!String(block.text || '').trim()) return '';
    const fontSize = Math.round(clamp(block.fontSize, 10, 48, 16));
    const lineHeight = clamp(block.lineHeight, 1, 2.2, 1.4);
    const color = safeColor(block.color, '#222222');
    const align = safeAlign(block.align);
    const fontWeight = safeFontWeight(block.fontWeight, 600);
    const font = resolveNewsletterFont(block.font, settings.headingFont);

    return sectionTable(block, settings, `
<h2 class="email-heading-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(block.text)}</h2>`.trim());
};

const renderSmallText = (block, settings) => {
    if (!String(block.text || '').trim()) return '';
    const fontSize = Math.round(clamp(block.fontSize, 10, 30, 16));
    const lineHeight = clamp(block.lineHeight, 1, 2.4, 1.6);
    const color = safeColor(block.color, '#222222');
    const align = safeAlign(block.align);
    const fontWeight = safeFontWeight(block.fontWeight, 400);
    const font = resolveNewsletterFont(block.font, settings.bodyFont);

    return sectionTable(block, settings, `
<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(block.text)}</p>`.trim());
};

const renderText = (block, settings) => {
    if (!String(block.text || '').trim()) return '';
    const fontSize = Math.round(clamp(block.fontSize, 10, 40, 16));
    const lineHeight = clamp(block.lineHeight, 1, 2.4, 1.6);
    const color = safeColor(block.color, '#222222');
    const align = safeAlign(block.align);
    const fontWeight = safeFontWeight(block.fontWeight, 400);
    const linkColor = safeColor(block.linkColor, '#2457d6');
    const linkFontWeight = safeFontWeight(block.linkFontWeight, 600);
    const linkFontStyle = block.linkFontStyle === 'italic' ? 'italic' : 'normal';
    const linkUnderline = block.linkUnderline !== false;
    const font = resolveNewsletterFont(block.font, settings.bodyFont);
    const content = renderInlineText(block.text, block.links, {
        linkColor,
        linkFontFamily: font.family,
        linkFontWeight,
        linkFontStyle,
        linkUnderline,
    });

    return sectionTable(block, settings, `
<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};">${content}</p>`.trim());
};

const renderImageMarkup = ({
    imageUrl,
    alt,
    linkUrl,
    widthPercent = 100,
    align = 'center',
    rounded = false,
    availableWidth,
    fixedHeight = null,
}) => {
    const src = safeUrl(imageUrl);
    if (!src) return '';

    const normalizedWidth = Math.round(clamp(widthPercent, 20, 100, 100));
    const pixelWidth = Math.max(80, Math.round(availableWidth * (normalizedWidth / 100)));
    const radius = rounded ? 14 : 0;
    const normalizedAlign = safeAlign(align);
    const href = safeUrl(linkUrl);
    const normalizedHeight = fixedHeight === null
        ? null
        : Math.round(clamp(fixedHeight, 80, 260, 150));
    const heightAttribute = normalizedHeight === null ? '' : ` height="${normalizedHeight}"`;
    const heightStyle = normalizedHeight === null
        ? 'height:auto;'
        : `height:${normalizedHeight}px;object-fit:cover;`;
    const image = `<img src="${src}" width="${pixelWidth}"${heightAttribute} alt="${escapeNewsletterHtml(alt)}" style="display:block;width:${normalizedWidth}%;max-width:${pixelWidth}px;${heightStyle}border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />`;

    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr>
    <td align="${normalizedAlign}">${href ? `<a href="${href}" target="_blank" style="text-decoration:none;">${image}</a>` : image}</td>
  </tr>
</table>`.trim();
};

const EDITOR_IMAGE_PASTELS = ['#e7e3f7', '#dceef0', '#f7e7dc', '#e5f0df', '#f3e1ea'];

const editorImagePastel = (block) => {
    const seed = String(block?.id || 'image').split('').reduce((total, character) => total + character.charCodeAt(0), 0);
    return EDITOR_IMAGE_PASTELS[seed % EDITOR_IMAGE_PASTELS.length];
};

const renderImagePlaceholderMarkup = (block, settings, availableWidth, height = 230) => {
    const normalizedWidth = Math.round(clamp(block.widthPercent, 20, 100, 100));
    const pixelWidth = Math.max(80, Math.round(availableWidth * (normalizedWidth / 100)));
    const radius = block.rounded ? 14 : 0;
    const align = safeAlign(block.align);
    const pastel = editorImagePastel(block);
    const previewLabel = block.type === 'gif' ? 'GIF preview' : 'Image preview';
    const previewInstruction = block.type === 'gif' ? 'Choose an animated GIF' : 'Choose or upload an image';
    const previewContent = block.previewLoading
        ? '&nbsp;'
        : `${previewLabel}<br /><span style="font-size:12px;font-weight:400;">${previewInstruction}</span>`;

    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr>
    <td align="${align}">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${pixelWidth}" bgcolor="${pastel}" style="width:${normalizedWidth}%;max-width:${pixelWidth}px;border-collapse:separate;background-color:${pastel};border-radius:${radius}px;">
        <tr><td height="${height}" align="center" valign="middle" style="height:${height}px;padding:18px;color:#67627a;font-family:${settings.bodyFontFamily};font-size:14px;font-weight:600;line-height:1.4;text-align:center;vertical-align:middle;">${previewContent}</td></tr>
      </table>
    </td>
  </tr>
</table>`.trim();
};

const renderImagePlaceholder = (block, settings, availableWidth) => sectionTable(
    block,
    settings,
    `${renderImagePlaceholderMarkup(block, settings, availableWidth)}${renderImageCaption(block.caption, settings)}`,
);

const renderImageCaption = (caption, settings) => String(caption || '').trim()
    ? `<p class="email-body-font" style="margin:7px 0 0;${pinnedText('#666666')}font-family:${settings.bodyFontFamily};font-size:11px;font-weight:400;line-height:1.4;text-align:center;">${textWithBreaks(caption)}</p>`
    : '';

const renderImage = (block, settings, { renderPlaceholders = false } = {}) => {
    const availableWidth = settings.canvasWidth
        - Math.round(clamp(block.paddingLeft, 0, 72, 40))
        - Math.round(clamp(block.paddingRight, 0, 72, 40));

    const selectedImageUrl = safeUrl(block.imageUrl);
    const previewImageUrl = safeUrl(block.previewImageUrl);

    if (!selectedImageUrl && !previewImageUrl) {
        return renderPlaceholders ? renderImagePlaceholder(block, settings, availableWidth) : '';
    }

    const imageMarkup = renderImageMarkup({
        imageUrl: selectedImageUrl || previewImageUrl,
        alt: selectedImageUrl ? block.alt : (block.alt || block.previewImageAlt),
        linkUrl: block.linkUrl,
        widthPercent: block.widthPercent,
        align: block.align,
        rounded: block.rounded,
        availableWidth,
    });

    return sectionTable(block, settings, `${imageMarkup}${renderImageCaption(block.caption, settings)}`);
};

const renderButton = (block, settings, { renderPlaceholders = false } = {}) => {
    const url = safeUrl(block.url);
    if (!String(block.label || '').trim() || (!url && !renderPlaceholders)) return '';
    const label = escapeNewsletterHtml(block.label || 'Read more');
    const buttonColor = safeColor(block.buttonColor, '#000000');
    const textColor = safeColor(block.textColor, '#ffffff');
    const fontSize = Math.round(clamp(block.fontSize, 11, 28, 15));
    const fontWeight = safeFontWeight(block.fontWeight, 700);
    const align = safeAlign(block.align);
    const radius = block.rounded ? 9 : 0;
    const arcSize = block.rounded ? '18%' : '0%';
    const buttonWidth = Math.round(clamp(116 + String(block.label || '').length * 4.5, 148, 280, 180));
    const previewSafeUrl = url || '#';

    return sectionTable(block, settings, `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr>
    <td align="${align}">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${previewSafeUrl}" style="height:44px;v-text-anchor:middle;width:${buttonWidth}px;" arcsize="${arcSize}" strokecolor="${buttonColor}" fillcolor="${buttonColor}">
        <w:anchorlock/>
        <center class="email-body-font" style="${pinnedText(textColor)}font-family:${settings.bodyMsoFontFamily};font-size:${fontSize}px;font-weight:${fontWeight};">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a class="email-body-font" href="${previewSafeUrl}" target="_blank" style="display:inline-block;padding:13px 22px;${pinnedBackground(buttonColor)}border:1px solid ${buttonColor};border-radius:${radius}px;${pinnedText(textColor)}font-family:${settings.bodyFontFamily};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.2;text-align:center;text-decoration:none;">${label}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim());
};

const renderDivider = (block, settings) => {
    const color = safeColor(block.color, '#333333');
    const thickness = Math.round(clamp(block.thickness, 1, 8, 1));
    return sectionTable(block, settings, `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr><td height="${thickness}" style="height:${thickness}px;border-top:${thickness}px solid ${color};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`.trim());
};

const renderSpacer = (block, settings) => {
    const height = Math.round(clamp(block.height, 0, 240, 32));
    const backgroundColor = safeColor(block.backgroundColor, settings.canvasBackgroundColor);

    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${backgroundColor}" style="width:100%;border-collapse:collapse;${pinnedBackground(backgroundColor)}">
  <tr><td height="${height}" bgcolor="${backgroundColor}" style="height:${height}px;${pinnedBackground(backgroundColor)}font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`.trim();
};

const wrapColumnItem = (content, spacingBottom) => {
    if (!content) return '';
    const spacing = Math.round(clamp(spacingBottom, 0, 40, 12));
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr><td style="padding:0 0 ${spacing}px;">${content}</td></tr></table>`;
};

const renderColumnItem = (item, block, settings, availableWidth, { renderPlaceholders = false } = {}) => {
    if (!item || typeof item !== 'object') return '';

    if (item.type === 'heading') {
        if (!String(item.text || '').trim()) return '';
        const fontSize = Math.round(clamp(item.fontSize, 12, 42, block.headingFontSize || 20));
        const fontWeight = safeFontWeight(item.fontWeight, block.headingFontWeight || 700);
        const color = safeColor(item.color, safeColor(block.headingColor, '#222222'));
        const align = safeAlign(item.align);
        const font = resolveNewsletterFont(item.font, settings.headingFont);
        return wrapColumnItem(`<h2 class="email-heading-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.25;mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(item.text)}</h2>`, item.spacingBottom);
    }

    if (item.type === 'text') {
        if (!String(item.text || '').trim()) return '';
        const fontSize = Math.round(clamp(item.fontSize, 10, 30, block.textFontSize || 15));
        const fontWeight = safeFontWeight(item.fontWeight, block.textFontWeight || 400);
        const lineHeight = clamp(item.lineHeight, 1, 2.4, 1.55);
        const color = safeColor(item.color, safeColor(block.textColor, '#222222'));
        const align = safeAlign(item.align);
        const font = resolveNewsletterFont(item.font, settings.bodyFont);
        return wrapColumnItem(`<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};">${textWithBreaks(item.text)}</p>`, item.spacingBottom);
    }

    if (item.type === 'image') {
        const selectedImageUrl = safeUrl(item.imageUrl);
        const previewImageUrl = safeUrl(item.previewImageUrl);
        const image = selectedImageUrl || previewImageUrl
            ? renderImageMarkup({
                imageUrl: selectedImageUrl || previewImageUrl,
                alt: selectedImageUrl ? item.alt : (item.alt || item.previewImageAlt),
                linkUrl: item.linkUrl,
                widthPercent: item.widthPercent,
                align: item.align,
                rounded: item.rounded ?? block.imageRounded,
                availableWidth,
                fixedHeight: item.frameHeight ?? 150,
            })
            : renderPlaceholders
                ? renderImagePlaceholderMarkup(item, settings, availableWidth, item.frameHeight ?? 150)
                : '';
        return wrapColumnItem(`${image}${renderImageCaption(item.caption, settings)}`, item.spacingBottom);
    }

    if (item.type === 'button') {
        const url = safeUrl(item.url);
        if (!String(item.label || '').trim() || (!url && !renderPlaceholders)) return '';
        const label = escapeNewsletterHtml(item.label || 'Read more');
        const buttonColor = safeColor(item.buttonColor, '#000000');
        const textColor = safeColor(item.textColor, '#ffffff');
        const fontSize = Math.round(clamp(item.fontSize, 11, 24, 14));
        const fontWeight = safeFontWeight(item.fontWeight, 700);
        const align = safeAlign(item.align);
        const radius = item.rounded === false ? 0 : 8;
        const content = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr><td align="${align}"><table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="${buttonColor}" style="border-collapse:separate;${pinnedBackground(buttonColor)}border-radius:${radius}px;"><tr><td><a class="email-body-font" href="${url || '#'}" target="_blank" style="display:inline-block;padding:11px 16px;${pinnedText(textColor)}font-family:${settings.bodyFontFamily};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.2;text-decoration:none;">${label}</a></td></tr></table></td></tr></table>`;
        return wrapColumnItem(content, item.spacingBottom);
    }

    if (item.type === 'link') {
        const url = safeHttpsUrl(item.url);
        if (!String(item.text || '').trim() || (!url && !renderPlaceholders)) return '';
        const color = safeColor(item.color, '#2457d6');
        const fontSize = Math.round(clamp(item.fontSize, 10, 28, 14));
        const fontWeight = safeFontWeight(item.fontWeight, 600);
        const align = safeAlign(item.align);
        const font = resolveNewsletterFont(item.font, settings.bodyFont);
        const content = `<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;text-align:${align};"><a class="email-body-font ${newsletterFontClass(font)}" href="${url || '#'}" target="_blank" style="${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.4;text-decoration:${item.underline === false ? 'none' : 'underline'};">${textWithBreaks(item.text)}</a></p>`;
        return wrapColumnItem(content, item.spacingBottom);
    }

    return '';
};

const renderColumns = (block, settings, options = {}) => {
    const count = block.columnCount === 3 ? 3 : 2;
    const columns = Array.isArray(block.columns) ? block.columns.slice(0, count) : [];
    const gap = Math.round(clamp(block.gap, 0, 40, 20));
    const sectionWidth = settings.canvasWidth
        - Math.round(clamp(block.paddingLeft, 0, 72, 40))
        - Math.round(clamp(block.paddingRight, 0, 72, 40));
    const columnWidth = Math.floor((sectionWidth - gap * (count - 1)) / count);

    const renderedColumns = Array.from({ length: count }, (_, index) => {
        const column = columns[index] || {};
        return getNewsletterColumnItems(column)
            .map((item) => renderColumnItem(item, block, settings, columnWidth, options))
            .filter(Boolean)
            .join('');
    });
    if (!renderedColumns.some(Boolean)) return '';

    const cells = Array.from({ length: count }, (_, index) => {
        const leftPadding = index === 0 ? 0 : Math.ceil(gap / 2);
        const rightPadding = index === count - 1 ? 0 : Math.floor(gap / 2);

        return `
<td class="stack-column" width="${Math.floor(100 / count)}%" valign="top" style="width:${100 / count}%;padding:0 ${rightPadding}px 0 ${leftPadding}px;vertical-align:top;">
  ${renderedColumns[index]}
</td>`.trim();
    }).join('\n');

    return sectionTable(block, settings, `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr>${cells}</tr>
</table>`.trim());
};

const renderFooter = (block, settings) => {
    const color = safeColor(block.color, '#333333');
    const linkColor = safeColor(block.linkColor, '#a30021');
    const align = safeAlign(block.align);
    const websiteUrl = safeUrl(block.websiteUrl);
    const fontSize = Math.round(clamp(block.fontSize, 10, 22, 12));
    const fontWeight = safeFontWeight(block.fontWeight, 400);
    const brandFontWeight = Math.max(600, fontWeight);
    const font = resolveNewsletterFont(block.font, settings.bodyFont);

    return sectionTable(block, settings, `
<p class="email-heading-font ${newsletterFontClass(font)}" style="margin:0 0 10px;${pinnedText(color)}font-family:${font.family};font-size:${fontSize + 1}px;font-weight:${brandFontWeight};line-height:1.5;text-align:${align};">${escapeNewsletterHtml(block.brandName || 'Abodid Sahoo')}</p>
<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0 0 12px;${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.55;text-align:${align};">${textWithBreaks(block.message)}</p>
<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;${pinnedText(linkColor)}font-family:${font.family};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.55;text-align:${align};">
  ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" style="${pinnedText(linkColor)}text-decoration:underline;">${escapeNewsletterHtml(block.websiteLabel || 'Visit website')}</a>&nbsp;&nbsp;·&nbsp;&nbsp;` : ''}
  <a href="{{unsubscribe_url}}" style="${pinnedText(linkColor)}text-decoration:underline;">Unsubscribe</a>
</p>`.trim());
};

const renderLink = (block, settings) => {
    const url = safeHttpsUrl(block.url);
    if (!url || !String(block.text || '').trim()) return '';
    const fontSize = Math.round(clamp(block.fontSize, 10, 40, 16));
    const lineHeight = clamp(block.lineHeight, 1, 2.4, 1.5);
    const color = safeColor(block.color, '#2457d6');
    const align = safeAlign(block.align);
    const fontWeight = safeFontWeight(block.fontWeight, 600);
    const fontStyle = block.fontStyle === 'italic' ? 'italic' : 'normal';
    const underline = block.underline !== false;
    const font = resolveNewsletterFont(block.font, settings.bodyFont);

    return sectionTable(block, settings, `
<p class="email-body-font ${newsletterFontClass(font)}" style="margin:0;font-family:${font.family};font-size:${fontSize}px;line-height:${lineHeight};mso-line-height-rule:exactly;text-align:${align};"><a class="email-body-font ${newsletterFontClass(font)}" href="${url}" target="_blank" style="${pinnedText(color)}font-family:${font.family};font-size:${fontSize}px;font-style:${fontStyle};font-weight:${fontWeight};line-height:${lineHeight};text-decoration:${underline ? 'underline' : 'none'};">${textWithBreaks(block.text)}</a></p>`.trim());
};

const renderBlock = (block, settings, options = {}) => {
    if (!block || typeof block !== 'object') return '';
    switch (block.type) {
        case 'headingGroup': return renderHeadingGroup(block, settings);
        case 'heading': return renderHeading(block, settings);
        case 'subheading': return renderSubheading(block, settings);
        case 'smallText': return renderSmallText(block, settings);
        case 'text': return renderText(block, settings);
        case 'link': return renderLink(block, settings);
        case 'image': return renderImage(block, settings, options);
        case 'gif': return renderImage(block, settings, options);
        case 'button': return renderButton(block, settings, options);
        case 'divider': return renderDivider(block, settings);
        case 'spacer': return renderSpacer(block, settings);
        case 'columns': return renderColumns(block, settings, options);
        case 'footer': return renderFooter(block, settings);
        default: return '';
    }
};

/**
 * @param {{ blocks?: Array<Record<string, any>>, settings?: Record<string, any> }} options
 */
export const renderNewsletterBlocks = ({ blocks, settings, renderPlaceholders = false }) => {
    const normalizedSettings = normalizeNewsletterSettings(settings);
    const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
    const blocksWithFooter = normalizedBlocks.some((block) => block?.type === 'footer')
        ? normalizedBlocks
        : [...normalizedBlocks, createNewsletterBlock('footer')];

    return blocksWithFooter.map((block) => renderBlock(block, normalizedSettings, { renderPlaceholders })).filter(Boolean).join('\n');
};

/**
 * @param {{
 *   blocks?: Array<Record<string, any>>,
 *   settings?: Record<string, any>,
 *   previewText?: string,
 *   trackingPixelUrl?: string,
 *   renderPlaceholders?: boolean,
 *   responsive?: boolean
 * }} [options]
 */
export const compileNewsletterEmail = ({
    blocks,
    settings,
    previewText = '',
    trackingPixelUrl = '',
    renderPlaceholders = false,
    responsive = true,
} = {}) => {
    const normalizedSettings = normalizeNewsletterSettings(settings);
    const content = renderNewsletterBlocks({ blocks, settings: normalizedSettings, renderPlaceholders });
    const preview = previewText ? `
<div style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeNewsletterHtml(previewText)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>` : '';
    const pixelUrl = safeUrl(trackingPixelUrl);
    const trackingPixel = pixelUrl
        ? `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
        : '';

    return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title></title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <!--[if mso]>
  <style type="text/css">
${NEWSLETTER_FONT_OPTIONS.map((font) => `    .email-font-${font.value} { font-family:${font.msoFamily} !important; }`).join('\n')}
  </style>
  <![endif]-->
  <style>
${renderWebFontCss(normalizedSettings, Array.isArray(blocks) ? blocks : [])}
    :root { color-scheme:light only; supported-color-schemes:light only; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; }
${responsive ? `    @media only screen and (max-width: 680px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .stack-column { display:block !important; width:100% !important; max-width:100% !important; padding:0 0 22px !important; }
      .stack-column:last-child { padding-bottom:0 !important; }
      .mobile-section-padding { padding-left:24px !important; padding-right:24px !important; }
    }` : ''}
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;${pinnedBackground(normalizedSettings.outerBackgroundColor)}">
  ${preview}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${normalizedSettings.outerBackgroundColor}" style="width:100%;border-collapse:collapse;${pinnedBackground(normalizedSettings.outerBackgroundColor)}">
    <tr>
      <td align="center" bgcolor="${normalizedSettings.outerBackgroundColor}" style="padding:0;${pinnedBackground(normalizedSettings.outerBackgroundColor)}">
        <!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${normalizedSettings.canvasWidth}"><tr><td><![endif]-->
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${normalizedSettings.canvasBackgroundColor}" style="width:100%;max-width:${normalizedSettings.canvasWidth}px;border-collapse:collapse;${pinnedBackground(normalizedSettings.canvasBackgroundColor)}">
          <tr><td bgcolor="${normalizedSettings.canvasBackgroundColor}" style="padding:0;${pinnedBackground(normalizedSettings.canvasBackgroundColor)}">${content}${trackingPixel}</td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
};
