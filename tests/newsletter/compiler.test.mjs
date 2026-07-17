import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createNewsletterColumnItem,
    createDefaultNewsletterBlocks,
    createNewsletterBlock,
    DEFAULT_NEWSLETTER_BODY_TEXT,
    DEFAULT_NEWSLETTER_INTRO_TEXT,
    DEFAULT_NEWSLETTER_LINK_TEXT,
    DEFAULT_NEWSLETTER_LINK_URL,
    DEFAULT_NEWSLETTER_SETTINGS,
    DEFAULT_NEWSLETTER_SMALL_TEXT,
} from '../../src/lib/newsletter/blocks.js';
import { compileNewsletterEmail } from '../../src/lib/newsletter/compiler.js';

test('compiles a centred white email canvas on a controllable outer backdrop', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('text', { text: 'Hello' })],
        settings: {
            ...DEFAULT_NEWSLETTER_SETTINGS,
            outerBackgroundColor: '#112233',
            canvasBackgroundColor: '#fefefe',
        },
    });

    assert.match(html, /role="presentation"/);
    assert.match(html, /max-width:640px/);
    assert.match(html, /bgcolor="#112233"/);
    assert.match(html, /background-color:#112233/);
    assert.doesNotMatch(html, /background-color:#fefefe/);
    assert.match(html, /class="email-container"[^>]*bgcolor="#ffffff"/);
    assert.match(html, /{{unsubscribe_url}}/);
});

test('preserves precise typography controls as inline email styles', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('heading', {
            text: 'A precise heading',
            fontSize: 31,
            fontWeight: 600,
            color: '#123456',
            align: 'center',
        })],
    });

    assert.match(html, /font-size:31px/);
    assert.match(html, /font-weight:600/);
    assert.match(html, /color:#123456/);
    assert.match(html, /text-align:center/);
});

test('seeds new heading and text blocks with editable default copy', () => {
    const heading = createNewsletterBlock('heading');
    const paragraph = createNewsletterBlock('text');

    assert.equal(heading.text, 'Best possible heading');
    assert.equal(heading.paddingTop, 32);
    assert.equal(heading.paddingLeft, 40);
    assert.equal(heading.paddingRight, 40);
    assert.equal(heading.backgroundColor, '#000000');
    assert.equal(heading.color, '#ffffff');
    assert.equal(paragraph.text, DEFAULT_NEWSLETTER_BODY_TEXT);
    assert.equal(paragraph.color, '#222222');
    assert.equal(paragraph.backgroundColor, '#ffffff');
    assert.deepEqual(
        paragraph.links.map((link) => paragraph.text.slice(link.start, link.end)),
        ['exhibition design teams', 'super connector'],
    );
    assert.equal(DEFAULT_NEWSLETTER_SETTINGS.outerBackgroundColor, '#f3f2ef');
    assert.equal(DEFAULT_NEWSLETTER_SETTINGS.canvasBackgroundColor, '#ffffff');
});

test('creates an independently spaced subheading block', () => {
    const subheading = createNewsletterBlock('subheading');
    const html = compileNewsletterEmail({ blocks: [subheading] });

    assert.equal(subheading.text, 'an absolutely mindblowing subheading');
    assert.equal(subheading.fontSize, 16);
    assert.equal(subheading.paddingTop, 24);
    assert.equal(subheading.paddingBottom, 16);
    assert.equal(subheading.backgroundColor, '#ffffff');
    assert.equal(subheading.color, '#222222');
  assert.match(html, /<h2 class="email-heading-font[^"]*"/);
    assert.match(html, /font-size:16px/);
    assert.match(html, /padding:24px 40px 16px 40px/);
    assert.match(html, />an absolutely mindblowing subheading<\/h2>/);
});

test('uses a white content canvas with a black button by default', () => {
    const button = createNewsletterBlock('button');
    const divider = createNewsletterBlock('divider');
    const columns = createNewsletterBlock('columns');
    const footer = createNewsletterBlock('footer');

    assert.equal(button.backgroundColor, null);
    assert.equal(button.buttonColor, '#000000');
    assert.equal(button.textColor, '#ffffff');
    assert.equal(divider.backgroundColor, null);
    assert.equal(columns.headingColor, '#222222');
    assert.equal(columns.textColor, '#222222');
    assert.equal(columns.columns[0].items[1].color, '#222222');
    assert.equal(columns.columns[0].items[2].color, '#222222');
    assert.equal(footer.backgroundColor, '#ffffff');
    assert.equal(footer.color, '#333333');
    assert.equal(footer.linkColor, '#a30021');
    assert.equal(footer.brandName, 'Abodid Sahoo');
    assert.equal(footer.websiteLabel, 'Visit my Website');
    assert.equal(footer.websiteUrl, 'https://abodid.com');
    assert.equal(
        footer.message,
        'You received this newsletter because you have subscribed to receive updates from Abodid Sahoo or you may be connected with him personally or via LinkedIn/Instagram.',
    );

    const html = compileNewsletterEmail({
        blocks: [
            createNewsletterBlock('heading'),
            divider,
            createNewsletterBlock('button', { url: 'https://example.com/read' }),
        ],
    });

    assert.match(html, /bgcolor="#000000"[^>]*background-color:#000000/);
    assert.match(html, /bgcolor="#ffffff"[^>]*background-color:#ffffff/);
    assert.match(html, /background-color:#000000/);
    assert.match(html, /color:#ffffff/);
});

test('starts a new newsletter with the complete default content sequence', () => {
    const blocks = createDefaultNewsletterBlocks();

    assert.deepEqual(blocks.map((block) => block.type), [
        'headingGroup',
        'smallText',
        'image',
        'text',
        'divider',
        'subheading',
        'smallText',
        'columns',
        'link',
        'button',
        'footer',
    ]);
    assert.equal(blocks[0].headingText, 'Best possible heading');
    assert.equal(blocks[0].subheadingText, 'an absolutely mindblowing subheading');
    assert.equal(blocks[0].backgroundColor, '#000000');
    assert.equal(blocks[0].headingColor, '#ffffff');
    assert.equal(blocks[0].subheadingColor, '#ffffff');
    assert.equal(blocks[1].text, DEFAULT_NEWSLETTER_INTRO_TEXT);
    assert.match(blocks[1].text, /^As a creative director/);
    assert.doesNotMatch(blocks[1].text, /\{\{first_name\}\}/);
    assert.equal(blocks[1].paddingTop, 32);
    assert.equal(blocks[2].previewSource, 'moodboard');
    assert.equal(blocks[6].text, DEFAULT_NEWSLETTER_SMALL_TEXT);
    assert.deepEqual(blocks[7].columns[0].items.map((item) => item.type), ['image', 'heading', 'text']);
    assert.equal(blocks.some((block) => block.type === 'caseStudy'), false);
});

test('compiles the paired heading and subheading on one shared background', () => {
    const html = compileNewsletterEmail({ blocks: [createNewsletterBlock('headingGroup')] });

    assert.match(html, /bgcolor="#000000"/);
    assert.match(html, />Best possible heading<\/h1>/);
    assert.match(html, />an absolutely mindblowing subheading<\/h2>/);
    assert.equal((html.match(/bgcolor="#000000"/g) || []).length, 2);
});

test('compiles short text at the normal body-text size', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('smallText', { text: 'A concise introduction.' })],
    });

    assert.match(html, />A concise introduction\.<\/p>/);
    assert.match(html, /font-size:16px/);
    assert.match(html, /color:#222222/);
});

test('compiles the linked phrases in the default body copy', () => {
    const html = compileNewsletterEmail({ blocks: [createNewsletterBlock('text')] });

    assert.match(html, />exhibition design teams<\/a>/);
    assert.match(html, />super connector<\/a>/);
    assert.equal((html.match(/href="https:\/\/abodid\.com\/services"/g) || []).length, 2);
});

test('starts the canvas without a fixed top gap and compiles a controllable spacer', () => {
    const html = compileNewsletterEmail({
        blocks: [
            createNewsletterBlock('spacer', {
                height: 48,
                backgroundColor: '#fedcba',
            }),
            createNewsletterBlock('heading', { text: 'Starts after the spacer' }),
        ],
    });

    assert.match(html, /<td align="center" bgcolor="#f3f2ef" style="padding:0;/);
    assert.match(html, /height="48" bgcolor="#fedcba" style="height:48px;background-color:#fedcba;background-image:linear-gradient\(#fedcba,#fedcba\);font-size:0;line-height:0;"/);
    assert.match(html, /bgcolor="#fedcba"/);
    assert.match(html, /padding:32px 40px 12px 40px/);
});

test('compiles selected paragraph text into a styled HTTPS link', () => {
    const text = 'Read the case study today.';
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('text', {
            text,
            links: [{ start: 9, end: 19, url: 'https://example.com/case-study?ref=email&source=newsletter' }],
            linkColor: '#123abc',
            linkFontWeight: 700,
            linkFontStyle: 'italic',
            linkUnderline: true,
        })],
    });

    assert.match(html, /Read the <a class="email-body-font"/);
    assert.match(html, /href="https:\/\/example\.com\/case-study\?ref=email&amp;source=newsletter"/);
    assert.match(html, /color:#123abc/);
    assert.match(html, /font-style:italic/);
    assert.match(html, /font-weight:700/);
    assert.match(html, /text-decoration:underline/);
    assert.match(html, />case study<\/a> today\./);
});

test('keeps non-HTTPS inline link ranges as safe plain text', () => {
    const text = 'Do not link this text.';
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('text', {
            text,
            links: [
                { start: 7, end: 16, url: 'http://example.com' },
                { start: 7, end: 16, url: 'javascript:alert(1)' },
            ],
        })],
    });

    assert.match(html, /Do not link this text\./);
    assert.doesNotMatch(html, /href="http:/);
    assert.doesNotMatch(html, /javascript:/);
});

test('compiles a dedicated link block as clean underlined clickable text', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('link', {
            text: 'Read the full story',
            url: 'https://example.com/story?source=newsletter',
            color: '#3456ab',
            fontSize: 18,
            fontWeight: 700,
            underline: true,
            align: 'center',
        })],
    });

    assert.match(html, /href="https:\/\/example\.com\/story\?source=newsletter"/);
    assert.match(html, /color:#3456ab/);
    assert.match(html, /font-size:18px/);
    assert.match(html, /font-weight:700/);
    assert.match(html, /text-decoration:underline/);
    assert.match(html, /text-align:center/);
    assert.match(html, />Read the full story<\/a>/);
});

test('seeds a dedicated link block as simple blue linked text', () => {
    const link = createNewsletterBlock('link');
    const html = compileNewsletterEmail({ blocks: [link] });

    assert.equal(link.text, DEFAULT_NEWSLETTER_LINK_TEXT);
    assert.equal(link.url, DEFAULT_NEWSLETTER_LINK_URL);
    assert.equal(link.backgroundColor, '#ffffff');
    assert.equal(link.color, '#2457d6');
    assert.equal(link.underline, true);
    assert.match(html, />Download the Obsidian 101 Guide<\/a>/);
    assert.match(html, /text-decoration:underline/);
    assert.match(html, /color:#2457d6/);
    assert.match(html, /href="https:\/\/jwipqbjxpmgyevfzpjjx\.supabase\.co\/storage\/v1\/object\/public\/misc\/cv\/Abodid-Sahoo-2026-CV\.pdf\?download=Abodid%20Sahoo%20-%202026%20CV\.pdf"/);
});

test('rejects non-HTTPS destinations in a dedicated link block', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('link', {
            text: 'Unsafe link',
            url: 'javascript:alert(1)',
        })],
    });

    assert.doesNotMatch(html, /Unsafe link/);
    assert.doesNotMatch(html, /javascript:/);
});

test('uses separate curated font stacks for headings and body copy', () => {
    const html = compileNewsletterEmail({
        blocks: [
            createNewsletterBlock('heading', { text: 'Editorial heading', font: 'georgia' }),
            createNewsletterBlock('text', { text: 'Readable body copy', font: 'verdana' }),
        ],
        settings: {
            ...DEFAULT_NEWSLETTER_SETTINGS,
            headingFont: 'georgia',
            bodyFont: 'verdana',
        },
    });

    assert.match(html, /class="email-heading-font email-font-georgia"[^>]+font-family:Georgia, 'Times New Roman', Times, serif/);
    assert.match(html, /class="email-body-font email-font-verdana"[^>]+font-family:Verdana, Tahoma, sans-serif/);
    assert.match(html, /\.email-font-georgia \{ font-family:Georgia, 'Times New Roman', serif !important; \}/);
    assert.match(html, /\.email-font-verdana \{ font-family:Verdana, sans-serif !important; \}/);
    assert.doesNotMatch(html, /@font-face/);
});

test('exports Satoshi as a progressive web font with safe fallbacks', () => {
    const html = compileNewsletterEmail({
        blocks: [
            createNewsletterBlock('heading', { text: 'Brand heading' }),
            createNewsletterBlock('text', { text: 'Brand body' }),
        ],
    });

    assert.match(html, /@font-face \{ font-family:'Satoshi'/);
    assert.match(html, /https:\/\/abodid\.com\/fonts\/satoshi\/Satoshi-Regular\.woff2/);
    assert.match(html, /font-family:'Satoshi', 'Helvetica Neue', Arial, sans-serif/);
    assert.match(html, /\.email-font-satoshi \{ font-family:Arial, sans-serif !important; \}/);
});

test('compiles image width and one-click corner choices', () => {
    const roundedHtml = compileNewsletterEmail({
        blocks: [createNewsletterBlock('image', {
            imageUrl: 'https://example.com/image.jpg',
            alt: 'A project image',
            caption: 'A very small centred caption',
            widthPercent: 55,
            rounded: true,
        })],
    });
    const sharpHtml = compileNewsletterEmail({
        blocks: [createNewsletterBlock('image', {
            imageUrl: 'https://example.com/image.jpg',
            widthPercent: 55,
            rounded: false,
        })],
    });

    assert.match(roundedHtml, /width:55%/);
    assert.match(roundedHtml, /border-radius:14px/);
    assert.match(roundedHtml, /alt="A project image"/);
    assert.match(roundedHtml, /font-size:11px/);
    assert.match(roundedHtml, /text-align:center/);
    assert.match(roundedHtml, />A very small centred caption<\/p>/);
    assert.match(sharpHtml, /border-radius:0px/);
});

test('shows unfinished buttons and images only as editor preview placeholders', () => {
    const blocks = [
        createNewsletterBlock('button'),
        createNewsletterBlock('image'),
    ];
    const editorHtml = compileNewsletterEmail({ blocks, renderPlaceholders: true });
    const exportedHtml = compileNewsletterEmail({ blocks });

    assert.match(editorHtml, /href="#"/);
    assert.match(editorHtml, />Read more<\/a>/);
    assert.match(editorHtml, /Image preview/);
    assert.match(editorHtml, /Choose or upload an image/);
    assert.doesNotMatch(exportedHtml, />Read more<\/a>/);
    assert.doesNotMatch(exportedHtml, /Image preview/);
});

test('exports a loaded mood-board sample so delivery matches the editor preview', () => {
    const image = createNewsletterBlock('image', {
        previewImageUrl: 'https://media.example.com/exhibitions/sample.jpg',
        previewImageAlt: 'Exhibition installation',
    });
    const editorHtml = compileNewsletterEmail({ blocks: [image], renderPlaceholders: true });
    const exportedHtml = compileNewsletterEmail({ blocks: [image] });

    assert.match(editorHtml, /src="https:\/\/media\.example\.com\/exhibitions\/sample\.jpg"/);
    assert.match(editorHtml, /alt="Exhibition installation"/);
    assert.match(exportedHtml, /src="https:\/\/media\.example\.com\/exhibitions\/sample\.jpg"/);
    assert.match(exportedHtml, /alt="Exhibition installation"/);
});

test('pins the chosen light palette against automatic email dark-mode recolouring', () => {
    const html = compileNewsletterEmail({
        settings: { outerBackgroundColor: '#f3f2ef' },
        blocks: [createNewsletterBlock('headingGroup')],
    });

    assert.match(html, /name="color-scheme" content="light only"/);
    assert.match(html, /name="supported-color-schemes" content="light only"/);
    assert.match(html, /background-image:linear-gradient\(#000000,#000000\)/);
    assert.match(html, /-webkit-text-fill-color:#ffffff/);
    assert.match(html, /background-image:linear-gradient\(#f3f2ef,#f3f2ef\)/);
});

test('creates an insertable GIF block that exports as an email-safe image', () => {
    const gif = createNewsletterBlock('gif', {
        imageUrl: 'https://media.example.com/moodboard/into-the-flux.gif',
        alt: 'Into the Flux',
    });
    const html = compileNewsletterEmail({ blocks: [gif] });

    assert.equal(gif.previewSource, 'moodboardGif');
    assert.match(html, /src="https:\/\/media\.example\.com\/moodboard\/into-the-flux\.gif"/);
    assert.match(html, /alt="Into the Flux"/);
});

test('shows an unfinished GIF as a distinct editor preview only', () => {
    const gif = createNewsletterBlock('gif');
    const editorHtml = compileNewsletterEmail({ blocks: [gif], renderPlaceholders: true });
    const exportedHtml = compileNewsletterEmail({ blocks: [gif] });

    assert.match(editorHtml, /GIF preview/);
    assert.match(editorHtml, /Choose an animated GIF/);
    assert.doesNotMatch(exportedHtml, /GIF preview/);
});

test('creates immediately visible columns with independent nested elements', () => {
    const columns = createNewsletterBlock('columns');
    columns.columns[0].items[0].imageUrl = 'https://example.com/column-image.jpg';
    const html = compileNewsletterEmail({ blocks: [columns] });

    assert.equal(columns.columns.length, 2);
    assert.equal(columns.columns[0].items.length, 3);
    assert.equal(columns.columns[1].items.length, 3);
    assert.equal(columns.columns[0].items[0].type, 'image');
    assert.equal(columns.columns[1].items[0].type, 'image');
    assert.equal(columns.columns[0].items[0].frameHeight, 150);
    assert.match(html, />Stories that connect people<\/h2>/);
    assert.match(html, /Stories can communicate ideas, educate and bring people together\./);
    assert.match(html, />Research-driven creative work<\/h2>/);
    assert.match(html, /Research helps me create work that feels intuitive and accessible\./);
    assert.equal(columns.columns[0].items[2].fontSize, 15);
    assert.equal(columns.columns[1].items[2].fontSize, 15);
    assert.match(html, /height="150"/);
    assert.match(html, /height:150px;object-fit:cover/);
    assert.equal((html.match(/class="stack-column"/g) || []).length, 2);
});

test('compiles different element stacks inside each selected column', () => {
    const columns = createNewsletterBlock('columns', {
        gap: 20,
        columns: [
            {
                id: 'left',
                items: [
                    createNewsletterColumnItem('heading', { text: 'Left heading' }),
                    createNewsletterColumnItem('button', { label: 'Left action', url: 'https://example.com/left' }),
                ],
            },
            {
                id: 'right',
                items: [
                    createNewsletterColumnItem('text', { text: 'Right paragraph' }),
                    createNewsletterColumnItem('image'),
                ],
            },
        ],
    });
    const html = compileNewsletterEmail({ blocks: [columns], renderPlaceholders: true });

    assert.match(html, /Left heading/);
    assert.match(html, /href="https:\/\/example\.com\/left"/);
    assert.match(html, /Right paragraph/);
    assert.match(html, /Image preview/);
    assert.match(html, /padding:0 10px 0 0/);
    assert.match(html, /padding:0 0px 0 10px/);
});

test('respects body-edge and extra-inset alignment for images and column groups', () => {
    const alignedImage = createNewsletterBlock('image', {
        imageUrl: 'https://example.com/aligned.jpg',
        paddingLeft: 40,
        paddingRight: 40,
    });
    const insetColumns = createNewsletterBlock('columns', {
        paddingLeft: 56,
        paddingRight: 56,
    });
    const html = compileNewsletterEmail({ blocks: [alignedImage, insetColumns] });

    assert.match(html, /padding:16px 40px 16px 40px/);
    assert.match(html, /padding:20px 56px 20px 56px/);
});

test('adds mobile stacking rules for two- and three-column blocks', () => {
    const columns = createNewsletterBlock('columns', {
        columnCount: 3,
        columns: [
            { id: 'one', heading: 'One', text: '', imageUrl: '', alt: '' },
            { id: 'two', heading: 'Two', text: '', imageUrl: '', alt: '' },
            { id: 'three', heading: 'Three', text: '', imageUrl: '', alt: '' },
        ],
    });
    const html = compileNewsletterEmail({
        blocks: [columns],
    });

    assert.match(html, /@media only screen and \(max-width: 680px\)/);
    assert.match(html, /padding-left:24px !important; padding-right:24px !important/);
    assert.match(html, /One/);
    assert.match(html, /Two/);
    assert.match(html, /Three/);
    assert.equal((html.match(/class="stack-column"/g) || []).length, 3);
});

test('keeps columns side by side in the constrained desktop editor preview', () => {
    const html = compileNewsletterEmail({
        blocks: [createNewsletterBlock('columns')],
        responsive: false,
    });

    assert.equal((html.match(/class="stack-column"/g) || []).length, 2);
    assert.doesNotMatch(html, /\.stack-column \{ display:block !important/);
    assert.match(html, /width:50%;padding:0 10px 0 0/);
    assert.match(html, /width:50%;padding:0 0px 0 10px/);
});

test('escapes editor content and rejects unsafe URLs', () => {
    const html = compileNewsletterEmail({
        blocks: [
            createNewsletterBlock('text', { text: '<script>alert("x")</script>' }),
            createNewsletterBlock('button', { label: '<Click>', url: 'javascript:alert(1)' }),
        ],
    });

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /javascript:/);
});
