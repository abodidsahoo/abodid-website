import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    BUTTON_STYLE_OPTIONS,
    DEFAULT_DESIGN_SETTINGS,
    FONT_OPTIONS,
    designSettingsToCssVariables,
    designSettingsToTextOverrideCss,
    normalizeDesignSettings,
} from '../../lib/designTheme';

const SETTINGS_KEY = 'global';
const AUTOSAVE_DELAY_MS = 1000;
const LIVE_PREVIEW_DEBOUNCE_MS = 120;
const PREVIEW_STORAGE_KEY = 'design_live_preview_v1';
const PREVIEW_CHANNEL = 'design-live-preview';

const TABS = [
    { id: 'defaults', label: 'Set Default Values' },
    { id: 'overrides', label: 'Override Design' },
];

const MODE_OPTIONS = [
    { id: 'dark', label: 'Dark Mode' },
    { id: 'light', label: 'Light Mode' },
];
const OVERRIDE_SCOPE_OPTIONS = [
    { id: 'feature', label: 'Feature Targets' },
    { id: 'page', label: 'Major Pages' },
];

const TYPE_TOKENS = [
    { id: 'h1', label: 'H1', sample: 'Creative systems that feel alive.', min: 1.5, max: 8, step: 0.05 },
    { id: 'h2', label: 'H2', sample: 'Build interactive work with intent.', min: 1.4, max: 7, step: 0.05 },
    { id: 'h3', label: 'H3', sample: 'Structure the story with rhythm.', min: 1.2, max: 6, step: 0.05 },
    { id: 'h4', label: 'H4', sample: 'Supportive heading for dense sections.', min: 1, max: 5, step: 0.05 },
    { id: 'h5', label: 'H5', sample: 'Secondary title token.', min: 0.9, max: 4, step: 0.05 },
    { id: 'h6', label: 'H6', sample: 'Micro heading token.', min: 0.8, max: 3, step: 0.05 },
    { id: 'paragraph', label: 'Paragraph', sample: 'Readable editorial paragraph for project stories and reflections.', min: 0.75, max: 2, step: 0.01 },
    { id: 'small', label: 'Small', sample: 'Small support text for details.', min: 0.65, max: 1.5, step: 0.01 },
    { id: 'custom1', label: 'Custom 1', sample: 'BIG EXPERIMENTAL TEXT', min: 1, max: 14, step: 0.05 },
    { id: 'custom2', label: 'Custom 2', sample: 'tiny interface detail', min: 0.5, max: 3, step: 0.01 },
    { id: 'custom3', label: 'Custom 3', sample: 'Feature label / highlight', min: 0.8, max: 8, step: 0.05 },
    { id: 'custom4', label: 'Custom 4', sample: 'Editorial highlight paragraph style.', min: 0.7, max: 4, step: 0.01 },
];

const TYPE_TOKEN_FONT_KEYS = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    paragraph: 'paragraph',
    small: 'paragraph',
    custom1: 'custom1',
    custom2: 'custom2',
    custom3: 'custom3',
    custom4: 'custom4',
};

const FEATURE_TYPEWRITER_TOKENS = [
    {
        id: 'typewriterMain',
        label: 'Typewriter Main Text',
        target: '.hero-title',
        sample: 'The future of creative technology is authored with intent.',
        min: 1.2,
        max: 10,
        step: 0.05,
    },
    {
        id: 'typewriterText',
        label: 'Typewriter Animated Text',
        target: '#typewriter-text',
        sample: 'Design & Technology.',
        min: 0.5,
        max: 6,
        step: 0.01,
    },
    {
        id: 'typewriterBio',
        label: 'Typewriter Bio Text',
        target: '.bio-content p',
        sample: 'I build narrative-first internet experiences with code, motion, and research.',
        min: 0.75,
        max: 4,
        step: 0.01,
    },
];

const FEATURE_LANDING_TEXT_TOKENS = [
    {
        id: 'landingPhotoCta',
        label: 'Photo Section CTA (View All)',
        target: '.photo-projects-cta',
        sample: 'View All',
        min: 0.6,
        max: 2,
        step: 0.01,
    },
    {
        id: 'landingPhotoOverlayTitle',
        label: 'Photo Hover Title',
        target: '.photography-card .meta-overlay .title',
        sample: 'MUMBAI RAIN DIARIES',
        min: 0.8,
        max: 3,
        step: 0.01,
    },
    {
        id: 'landingPhotoOverlayMeta',
        label: 'Photo Hover Meta',
        target: '.photography-card .meta-overlay .category',
        sample: 'Photo Story',
        min: 0.6,
        max: 2,
        step: 0.01,
    },
    {
        id: 'landingWritingTitle',
        label: 'Writing Card Title',
        target: '.blog-title',
        sample: 'How Apple Funded My Dream at RCA',
        min: 0.8,
        max: 3.5,
        step: 0.01,
    },
    {
        id: 'landingWritingDate',
        label: 'Writing Card Date',
        target: '.blog-date',
        sample: 'FEB 18, 2026',
        min: 0.55,
        max: 1.6,
        step: 0.01,
    },
    {
        id: 'landingWritingCategory',
        label: 'Writing Card Category (Journal)',
        target: '.blog-category',
        sample: 'Journal',
        min: 0.6,
        max: 2,
        step: 0.01,
    },
    {
        id: 'landingWritingAction',
        label: 'Writing Card Action (View More)',
        target: '.blog-action',
        sample: 'VIEW MORE →',
        min: 0.6,
        max: 2,
        step: 0.01,
    },
];

const FEATURE_STACK_CONTROLS_TOKENS = [
    {
        id: 'landingStackPrimaryButton',
        label: 'Stack Main Button',
        target: '.activation-stack .start-btn .start-label-large',
        sample: 'Play Soundtrack',
        min: 0.6,
        max: 2.2,
        step: 0.01,
    },
    {
        id: 'landingStackSecondaryButton',
        label: 'Stack Secondary Button',
        target: '.activation-stack .mode-btn',
        sample: 'Story-wise',
        min: 0.55,
        max: 1.6,
        step: 0.01,
    },
    {
        id: 'landingStackPeelButton',
        label: 'Stack Peel / Refresh Button',
        target: '.activation-stack .refresh-stack-btn',
        sample: 'Refresh Loading',
        min: 0.55,
        max: 1.8,
        step: 0.01,
    },
    {
        id: 'landingStackMainText',
        label: 'Stack Main Text Panel',
        target: '.left-story-title-row, .left-story-copy',
        sample: 'Story of the Photo: selected narrative excerpt appears here.',
        min: 0.7,
        max: 2.2,
        step: 0.01,
    },
    {
        id: 'landingNavCardTitle',
        label: 'Stack Nav Card Title',
        target: '.nav-cards-section .card-title',
        sample: 'Portfolio',
        min: 0.7,
        max: 2.5,
        step: 0.01,
    },
    {
        id: 'landingNavCardLink',
        label: 'Stack Nav Card Link',
        target: '.nav-cards-section .card-link',
        sample: 'Photography Portfolio',
        min: 0.55,
        max: 1.8,
        step: 0.01,
    },
];

const FEATURE_NEWSLETTER_TOKENS = [
    {
        id: 'newsletterTitle',
        label: 'Newsletter Title',
        target: '.newsletter-headline',
        sample: 'Subscribe to my newsletter',
        min: 0.8,
        max: 4,
        step: 0.01,
    },
    {
        id: 'newsletterBody',
        label: 'Newsletter Body',
        target: '.newsletter-desc',
        sample: 'Get curated resources and insights every month.',
        min: 0.65,
        max: 2.2,
        step: 0.01,
    },
    {
        id: 'newsletterInput',
        label: 'Newsletter Input Text',
        target: '.newsletter-input',
        sample: 'Enter your email',
        min: 0.6,
        max: 1.8,
        step: 0.01,
    },
    {
        id: 'newsletterButton',
        label: 'Newsletter Primary Button',
        target: '.newsletter-submit-btn',
        sample: 'Subscribe',
        min: 0.55,
        max: 1.8,
        step: 0.01,
    },
    {
        id: 'newsletterSecondaryLink',
        label: 'Newsletter Secondary Link',
        target: '.secondary-link',
        sample: 'Preview the Curation Hub →',
        min: 0.55,
        max: 1.8,
        step: 0.01,
    },
];

const FEATURE_OBSIDIAN_TOKENS = [
    {
        id: 'obsidianNoteTitle',
        label: 'Obsidian Note Title',
        target: '.note-info h3',
        sample: 'How to think with systems',
        min: 0.6,
        max: 2.2,
        step: 0.01,
    },
    {
        id: 'obsidianTag',
        label: 'Obsidian Tag',
        target: '.vault-tag',
        sample: 'embodiment',
        min: 0.55,
        max: 1.8,
        step: 0.01,
    },
    {
        id: 'obsidianNoteBody',
        label: 'Obsidian Note Body',
        target: '.markdown-body',
        sample: 'This is a note paragraph from the Obsidian vault page.',
        min: 0.7,
        max: 2.4,
        step: 0.01,
    },
];

const FEATURE_OVERRIDE_GROUPS = [
    {
        id: 'typewriter',
        label: 'Typewriter',
        hint: 'Main, animated, and bio text in the hero typewriter block.',
        slots: FEATURE_TYPEWRITER_TOKENS,
    },
    {
        id: 'landing',
        label: 'Landing Photo + Writing',
        hint: 'Landing card texts including photo hover and writing metadata.',
        slots: FEATURE_LANDING_TEXT_TOKENS,
    },
    {
        id: 'stack',
        label: 'Card Stack + Menu',
        hint: 'Card stack controls, stack copy, and nav card titles/links.',
        slots: FEATURE_STACK_CONTROLS_TOKENS,
    },
    {
        id: 'newsletter',
        label: 'Newsletter',
        hint: 'Newsletter title, body, inputs, and CTA links/buttons.',
        slots: FEATURE_NEWSLETTER_TOKENS,
    },
    {
        id: 'obsidian',
        label: 'Obsidian',
        hint: 'Note title/body and tag typography in Obsidian pages.',
        slots: FEATURE_OBSIDIAN_TOKENS,
    },
];

const BRAND_COLORS = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'tertiary', label: 'Tertiary' },
    { key: 'accent', label: 'Accent' },
    { key: 'custom1', label: 'Custom Color 1' },
    { key: 'custom2', label: 'Custom Color 2' },
    { key: 'custom3', label: 'Custom Color 3' },
];
const BRAND_MODE_MICRO_FIELDS = [
    { key: 'pageBackground', label: 'Hidden / Page Background' },
    { key: 'surfaceBackground', label: 'Surface Background' },
    { key: 'headerBackground', label: 'Header Background' },
    { key: 'footerBackground', label: 'Footer Background' },
    { key: 'link', label: 'Link Color' },
    { key: 'linkHover', label: 'Link Hover Color' },
    { key: 'selection', label: 'Selection Color' },
];
const BRAND_TOKEN_OPTIONS = [
    { id: 'primary', label: 'Primary' },
    { id: 'secondary', label: 'Secondary' },
    { id: 'tertiary', label: 'Tertiary' },
    { id: 'accent', label: 'Accent' },
    { id: 'custom1', label: 'Custom 1' },
    { id: 'custom2', label: 'Custom 2' },
    { id: 'custom3', label: 'Custom 3' },
];

const MODE_COLOR_FIELDS = [
    { key: 'pageBackground', label: 'Page Background' },
    { key: 'surfaceBackground', label: 'Surface Background' },
    { key: 'surfaceHoverBackground', label: 'Surface Hover' },
    { key: 'headerBackground', label: 'Header Background' },
    { key: 'headerText', label: 'Header Text' },
    { key: 'headerBorder', label: 'Header Border' },
    { key: 'footerBackground', label: 'Footer Background' },
    { key: 'footerText', label: 'Footer Text' },
    { key: 'footerBorder', label: 'Footer Border' },
    { key: 'textPrimary', label: 'Text Primary' },
    { key: 'textSecondary', label: 'Text Secondary' },
    { key: 'textTertiary', label: 'Text Tertiary' },
    { key: 'borderSubtle', label: 'Border Subtle' },
    { key: 'borderStrong', label: 'Border Strong' },
    { key: 'link', label: 'Link Color' },
    { key: 'linkHover', label: 'Link Hover Color' },
    { key: 'selection', label: 'Selection Color' },
];

const TEXT_COLOR_OPTIONS = [
    { id: 'accent', label: 'Accent' },
    { id: 'primary', label: 'Primary' },
    { id: 'secondary', label: 'Secondary' },
    { id: 'tertiary', label: 'Tertiary' },
    { id: 'custom1', label: 'Custom 1' },
    { id: 'custom2', label: 'Custom 2' },
    { id: 'custom3', label: 'Custom 3' },
    { id: 'custom', label: 'Custom Hex' },
];

const TYPOGRAPHY_COLOR_OPTIONS = [
    { id: 'textPrimary', label: 'Text Primary' },
    { id: 'textSecondary', label: 'Text Secondary' },
    { id: 'textTertiary', label: 'Text Tertiary' },
    { id: 'accent', label: 'Accent' },
    { id: 'primary', label: 'Primary' },
    { id: 'secondary', label: 'Secondary' },
    { id: 'tertiary', label: 'Tertiary' },
    { id: 'custom1', label: 'Custom 1' },
    { id: 'custom2', label: 'Custom 2' },
    { id: 'custom3', label: 'Custom 3' },
    { id: 'custom', label: 'Custom Hex' },
];

const TEXT_SCAN_LIMIT = 180;
const SCAN_FOCUS_FILTERS = [
    { id: 'all', label: 'All Areas' },
    { id: 'header_menu', label: 'Header Menu' },
    { id: 'header_segments', label: 'Header Segments' },
    { id: 'card_stack', label: 'Card Stack' },
    { id: 'title_buttons', label: 'Title / Buttons' },
    { id: 'body_text', label: 'Body Text' },
    { id: 'footer_titles', label: 'Footer Titles' },
    { id: 'blog_content', label: 'Blog Content' },
    { id: 'page_sections', label: 'Page Sections' },
];
const SCAN_PAGE_GROUPS = [
    { id: 'all', label: 'All Pages' },
    { id: 'landing', label: 'Landing' },
    { id: 'blog', label: 'Blog' },
    { id: 'research', label: 'Research' },
    { id: 'resources', label: 'Resources' },
    { id: 'experiments', label: 'Experiments' },
    { id: 'other', label: 'Other Pages' },
];
const SCAN_SIZE_PRESETS = [
    { id: 'h1', label: 'H1' },
    { id: 'h2', label: 'H2' },
    { id: 'h3', label: 'H3' },
    { id: 'h4', label: 'H4' },
    { id: 'h5', label: 'H5' },
    { id: 'h6', label: 'H6' },
    { id: 'paragraph', label: 'Paragraph' },
    { id: 'small', label: 'Small' },
    { id: 'custom1', label: 'Custom 1' },
    { id: 'custom2', label: 'Custom 2' },
    { id: 'custom3', label: 'Custom 3' },
    { id: 'custom4', label: 'Custom 4' },
];
const TYPE_PRESET_OPTIONS = [...SCAN_SIZE_PRESETS, { id: 'link', label: 'Link' }];
const PAGE_OVERRIDE_PROFILES = [
    {
        id: 'landing_page',
        label: 'Landing Page',
        route: '/',
        hint: 'Primary landing typography including hero, cards, and menu controls.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'menu_primary', label: 'Menu Primary Links', selector: '.mega-menu .dominant-link', sample: 'Research' },
            { id: 'menu_secondary', label: 'Menu Secondary Links', selector: '.mega-menu .mono-link, .mega-menu .mono-text-link', sample: 'Curated Resources Mega Vault' },
            { id: 'menu_labels', label: 'Menu Labels', selector: '.mega-menu .mono-label', sample: 'Resources' },
            { id: 'hero_title', label: 'Hero Title', selector: '.hero-title', sample: 'Hi, I am Abodid.' },
            { id: 'hero_bio', label: 'Hero Bio', selector: '.bio-content p', sample: 'With over 8+ years of experience in photography...' },
            { id: 'photo_title', label: 'Photography Card Title', selector: '.photography-card .meta-overlay .title', sample: 'MUMBAI RAIN DIARIES' },
            { id: 'writing_title', label: 'Writing Title', selector: '.blog-title', sample: 'How Apple Funded My Dream at RCA' },
            { id: 'writing_meta', label: 'Writing Meta', selector: '.blog-date, .blog-category, .blog-action', sample: 'FEB 18, 2026 · Journal · View More' },
        ],
    },
    {
        id: 'blog_index',
        label: 'Blog Index',
        route: '/blog',
        hint: 'Typography controls for blog listing page cards and headings.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Blog' },
            { id: 'card_title', label: 'Blog Card Title', selector: '.blog-card h3, .blog-title', sample: 'Project Learnings from Creative Practice' },
            { id: 'card_meta', label: 'Blog Card Meta', selector: '.blog-date, .blog-category, time', sample: 'FEB 20, 2026' },
            { id: 'card_excerpt', label: 'Blog Card Excerpt', selector: '.blog-card p, .blog-excerpt', sample: 'A short reflection from my latest experiment.' },
        ],
    },
    {
        id: 'blog_article',
        label: 'Blog Article',
        route: '',
        hint: 'Detail-page controls for long-form blog article layout.',
        targets: [
            { id: 'article_title', label: 'Article Title', selector: '.blog-post-title, article h1, .post-title', sample: 'The Narrative Behind a Creative System' },
            { id: 'article_meta', label: 'Article Meta', selector: '.blog-meta, .post-meta, time', sample: 'FEB 20, 2026 · Journal' },
            { id: 'article_subheading', label: 'Article Subheading', selector: 'article h2, article h3', sample: 'Building a consistent visual language' },
            { id: 'article_body', label: 'Article Body', selector: 'article p, .markdown-body p, .post-content p', sample: 'This is the main body paragraph for your article.' },
            { id: 'article_links', label: 'Article Links', selector: 'article a, .post-content a', sample: 'Read related reference' },
        ],
    },
    {
        id: 'photography_index',
        label: 'Photography Index',
        route: '/photography',
        hint: 'Typography controls for photography listing, overlays, and labels.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Photography' },
            { id: 'card_overlay_title', label: 'Card Overlay Title', selector: '.photography-card .meta-overlay .title', sample: 'MUMBAI RAIN DIARIES' },
            { id: 'card_overlay_meta', label: 'Card Overlay Meta', selector: '.photography-card .meta-overlay .category', sample: 'Photo Story' },
            { id: 'card_cta', label: 'Card CTA', selector: '.photo-projects-cta, .link-arrow', sample: 'View All' },
        ],
    },
    {
        id: 'photography_story',
        label: 'Photography Story Page',
        route: '',
        hint: 'Controls for typography on individual photography stories.',
        targets: [
            { id: 'story_title', label: 'Story Title', selector: '.story-title, .project-title, article h1', sample: 'The Streetlight Project' },
            { id: 'story_meta', label: 'Story Meta', selector: '.story-meta, .project-meta, .meta', sample: '2026 · Documentary' },
            { id: 'story_body', label: 'Story Body', selector: '.story-content p, article p, .project-content p', sample: 'Narrative paragraph describing the project context.' },
            { id: 'story_caption', label: 'Image Caption', selector: '.story-caption, figcaption', sample: 'Frame from the evening sequence.' },
        ],
    },
    {
        id: 'research_index',
        label: 'Research Index',
        route: '/research',
        hint: 'Typography controls for research landing and project cards.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Research' },
            { id: 'section_title', label: 'Section Title', selector: '.section-title, main h2', sample: 'Selected Projects' },
            { id: 'card_title', label: 'Project Card Title', selector: '.project-card h3, .research-card h3', sample: 'Invisible Punctum' },
            { id: 'card_body', label: 'Project Card Body', selector: '.project-card p, .research-card p', sample: 'A short summary of the project context.' },
            { id: 'card_link', label: 'Project Card Link', selector: '.project-card a, .research-card a', sample: 'Explore project' },
        ],
    },
    {
        id: 'resources_index',
        label: 'Resources Index',
        route: '/resources',
        hint: 'Typography controls for curated resources listing and cards.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Curated Resources' },
            { id: 'section_title', label: 'Section Title', selector: '.section-title, main h2', sample: 'Featured Collection' },
            { id: 'card_title', label: 'Resource Card Title', selector: '.resource-card h3, .resource-title', sample: 'Creative Prompt Libraries' },
            { id: 'card_meta', label: 'Resource Card Meta', selector: '.resource-card .meta, .resource-card p', sample: 'Design · Tooling · Curation' },
            { id: 'card_link', label: 'Resource Card Link', selector: '.resource-card a', sample: 'Open resource' },
        ],
    },
    {
        id: 'newsletter_page',
        label: 'Newsletter Page',
        route: '/newsletter',
        hint: 'Typography controls for newsletter page and subscription UI.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'newsletter_title', label: 'Newsletter Title', selector: '.newsletter-headline', sample: 'Subscribe to my newsletter' },
            { id: 'newsletter_body', label: 'Newsletter Body', selector: '.newsletter-desc, .trust-microcopy', sample: 'Get curated resources every month.' },
            { id: 'newsletter_input', label: 'Input Text', selector: '.newsletter-input', sample: 'Email Address' },
            { id: 'newsletter_action', label: 'Primary / Secondary Actions', selector: '.newsletter-submit-btn, .secondary-link', sample: 'Subscribe · Preview the Curation Hub' },
        ],
    },
    {
        id: 'about_page',
        label: 'About Page',
        route: '/about',
        hint: 'Typography controls for about page headings and narrative body.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'About Me' },
            { id: 'section_title', label: 'Section Headings', selector: 'main h2, main h3', sample: 'Creative Direction' },
            { id: 'body_text', label: 'Body Text', selector: 'main p', sample: 'I work at the intersection of storytelling and systems.' },
            { id: 'link_text', label: 'Links', selector: 'main a', sample: 'Read more' },
        ],
    },
    {
        id: 'contact_page',
        label: 'Contact Page',
        route: '/contact',
        hint: 'Typography controls for contact page header, form, and helper text.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Contact' },
            { id: 'body_text', label: 'Body Text', selector: 'main p, .contact-copy', sample: 'Let us collaborate on your next project.' },
            { id: 'form_labels', label: 'Form Labels', selector: 'main label, .contact-form label', sample: 'Your email' },
            { id: 'form_inputs', label: 'Form Inputs', selector: 'main input, main textarea', sample: 'Type your message...' },
            { id: 'form_button', label: 'Form Button', selector: 'main button, .contact-form button', sample: 'Send Message' },
        ],
    },
    {
        id: 'films_page',
        label: 'Films Page',
        route: '/films',
        hint: 'Typography controls for films listing and related metadata.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Filmmaking' },
            { id: 'card_title', label: 'Film Title', selector: '.film-card h3, .film-title', sample: 'Curves and Colors' },
            { id: 'card_meta', label: 'Film Meta', selector: '.film-card .meta, .film-card p', sample: 'Commercial · 2025' },
            { id: 'card_link', label: 'Film Link', selector: '.film-card a', sample: 'Watch film' },
        ],
    },
    {
        id: 'awards_page',
        label: 'Awards Page',
        route: '/awards',
        hint: 'Typography controls for awards list and credentials blocks.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Awards' },
            { id: 'section_title', label: 'Section Headings', selector: 'main h2, main h3', sample: 'Scholarships & Recognition' },
            { id: 'item_title', label: 'Award Item Title', selector: '.award-card h3, .award-item h3', sample: 'Apple Scholarship' },
            { id: 'item_meta', label: 'Award Meta / Description', selector: '.award-card p, .award-item p', sample: 'Recognized for excellence in creative technology.' },
        ],
    },
    {
        id: 'press_page',
        label: 'Press Page',
        route: '/press',
        hint: 'Typography controls for press mentions and publication links.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Press Mentions' },
            { id: 'card_title', label: 'Mention Title', selector: '.press-card h3, .mention-title', sample: 'Rolling Stone India Feature' },
            { id: 'card_meta', label: 'Publication / Meta', selector: '.press-card .meta, .mention-publication', sample: 'Rolling Stone India' },
            { id: 'card_link', label: 'Mention Link', selector: '.press-card a', sample: 'Read article' },
        ],
    },
    {
        id: 'experience_page',
        label: 'Experience Page',
        route: '/experience',
        hint: 'Typography controls for timeline and work experience content.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Experience' },
            { id: 'timeline_title', label: 'Timeline Title', selector: '.timeline-item h3, .experience-card h3', sample: 'Creative Director' },
            { id: 'timeline_meta', label: 'Timeline Meta', selector: '.timeline-item .meta, .experience-card .meta', sample: '2023 — Present' },
            { id: 'timeline_body', label: 'Timeline Body', selector: '.timeline-item p, .experience-card p', sample: 'Led research-driven storytelling projects.' },
        ],
    },
    {
        id: 'fundraising_page',
        label: 'Fundraising Page',
        route: '/fundraising',
        hint: 'Typography controls for campaign headings, cards, and CTA links.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Fundraising' },
            { id: 'campaign_title', label: 'Campaign Title', selector: '.fundraising-card h3, .campaign-title', sample: 'Cambridge Data School 2026' },
            { id: 'campaign_body', label: 'Campaign Description', selector: '.fundraising-card p, .campaign-description', sample: 'Supporting this learning journey helps scale impact.' },
            { id: 'campaign_cta', label: 'Campaign CTA', selector: '.fundraising-card a, .fundraising-card button', sample: 'Support this campaign' },
        ],
    },
    {
        id: 'moodboard_page',
        label: 'Moodboard Page',
        route: '/moodboard',
        hint: 'Typography controls for moodboard headings, cards, and labels.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Visual Moodboard' },
            { id: 'card_title', label: 'Board Card Title', selector: '.moodboard-card h3, .polaroid-title', sample: 'Cinematic Color Reference' },
            { id: 'card_meta', label: 'Board Card Meta', selector: '.moodboard-card p, .polaroid-meta', sample: 'Color · Composition · Atmosphere' },
            { id: 'card_link', label: 'Board Links', selector: '.moodboard-card a', sample: 'Open reference' },
        ],
    },
    {
        id: 'obsidian_vault',
        label: 'Obsidian Vault',
        route: '/research/obsidian-vault',
        hint: 'Typography controls for note listings, tags, and vault UI.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Vault Title', selector: 'main h1, .page-title', sample: 'Obsidian Vault' },
            { id: 'note_title', label: 'Note Title', selector: '.note-info h3', sample: 'How to think with systems' },
            { id: 'note_tag', label: 'Tags', selector: '.vault-tag', sample: 'embodiment' },
            { id: 'note_body', label: 'Note Body', selector: '.markdown-body, .markdown-body p', sample: 'This is a note paragraph from the Obsidian vault page.' },
        ],
    },
    {
        id: 'architecture_page',
        label: 'Architecture Page',
        route: '/architecture',
        hint: 'Typography controls for architecture docs and structural notes.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Website Architecture' },
            { id: 'section_title', label: 'Section Headings', selector: 'main h2, main h3', sample: 'Content Graph' },
            { id: 'body_text', label: 'Body Text', selector: 'main p, .architecture-copy p', sample: 'A map of pages, sections, and interaction flows.' },
            { id: 'link_text', label: 'Architecture Links', selector: 'main a', sample: 'Open node details' },
        ],
    },
    {
        id: 'services_page',
        label: 'Services Page',
        route: '/services',
        hint: 'Typography controls for service cards, outcomes, and CTA.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Services' },
            { id: 'service_title', label: 'Service Title', selector: '.service-card h3, .service-title', sample: 'Creative Strategy' },
            { id: 'service_body', label: 'Service Description', selector: '.service-card p, .service-description', sample: 'Narrative-led digital systems for brands.' },
            { id: 'service_cta', label: 'Service CTA', selector: '.service-card a, .service-card button', sample: 'Enquire now' },
        ],
    },
    {
        id: 'education_page',
        label: 'Education Page',
        route: '/education',
        hint: 'Typography controls for education timeline and academic blocks.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Education' },
            { id: 'entry_title', label: 'Entry Title', selector: '.education-card h3, .timeline-item h3', sample: 'Royal College of Art' },
            { id: 'entry_meta', label: 'Entry Meta', selector: '.education-card .meta, .timeline-item .meta', sample: 'London · 2026' },
            { id: 'entry_body', label: 'Entry Description', selector: '.education-card p, .timeline-item p', sample: 'Focused on design and technology systems.' },
        ],
    },
    {
        id: 'guestbook_page',
        label: 'Guestbook Page',
        route: '/guestbook',
        hint: 'Typography controls for guestbook heading, entries, and actions.',
        targets: [
            { id: 'menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'page_title', label: 'Page Title', selector: 'main h1, .page-title', sample: 'Guestbook' },
            { id: 'entry_name', label: 'Entry Name', selector: '.guestbook-entry h3, .guest-name', sample: 'A creative reader' },
            { id: 'entry_text', label: 'Entry Text', selector: '.guestbook-entry p, .guest-message', sample: 'Loved the research breakdown and references.' },
            { id: 'entry_meta', label: 'Entry Meta', selector: '.guestbook-entry .meta, .guest-date', sample: 'February 2026' },
        ],
    },
    {
        id: 'global_shell',
        label: 'Global Header + Footer',
        route: '',
        hint: 'Global shell controls that apply site-wide unless route-scoped overrides supersede them.',
        targets: [
            { id: 'global_menu_button', label: 'Header Menu Button', selector: '.menu-btn', sample: 'MENU' },
            { id: 'global_menu_primary', label: 'Menu Primary Links', selector: '.mega-menu .dominant-link', sample: 'Research' },
            { id: 'global_menu_secondary', label: 'Menu Secondary Links', selector: '.mega-menu .mono-link, .mega-menu .mono-text-link', sample: 'Curated Resources Mega Vault' },
            { id: 'global_menu_labels', label: 'Menu Labels', selector: '.mega-menu .mono-label', sample: 'Resources' },
            { id: 'footer_headers', label: 'Footer Headers', selector: '.site-footer .nav-header, .site-footer .section-title', sample: 'Resources' },
            { id: 'footer_links', label: 'Footer Links', selector: '.site-footer .nav-group a, .site-footer .legal-links a', sample: 'Privacy Policy' },
            { id: 'footer_copy', label: 'Footer Copy', selector: '.site-footer .copyright, .site-footer .newsletter-desc-text', sample: 'Subscribe to my newsletter...' },
        ],
    },
];

const CSS_VARIABLE_KEYS = Object.keys(designSettingsToCssVariables(DEFAULT_DESIGN_SETTINGS));

const cloneSettings = (value) => normalizeDesignSettings(JSON.parse(JSON.stringify(value)));

const formatDate = (value) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const cleanHex = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
};

const inferFontId = (fontFamily = '') => {
    const raw = String(fontFamily || '').toLowerCase();
    if (raw.includes('--font-custom-1')) return 'satoshi';
    if (raw.includes('--font-custom-2')) return 'space_mono';
    if (raw.includes('--font-custom-3')) return 'inconsolata';
    if (raw.includes('--font-custom-4')) return 'crimson';
    if (raw.includes('--font-ui')) return 'space_mono';
    if (raw.includes('--font-mono')) return 'inconsolata';
    if (raw.includes('--font-body') || raw.includes('--font-serif')) return 'crimson';
    if (raw.includes('space mono')) return 'space_mono';
    if (raw.includes('inconsolata')) return 'inconsolata';
    if (raw.includes('crimson')) return 'crimson';
    if (raw.includes('inter')) return 'inter';
    if (raw.includes('montserrat')) return 'montserrat';
    if (raw.includes('vt323')) return 'vt323';
    if (raw.includes('pixelify')) return 'pixelify';
    return 'satoshi';
};

const inferColorToken = (colorValue = '') => {
    const value = String(colorValue || '').toLowerCase();
    if (value.includes('--theme-color-primary') || value.includes('--color-primary')) return 'primary';
    if (value.includes('--theme-color-secondary')) return 'secondary';
    if (value.includes('--theme-color-tertiary')) return 'tertiary';
    if (value.includes('--custom-color-1')) return 'custom1';
    if (value.includes('--custom-color-2')) return 'custom2';
    if (value.includes('--custom-color-3')) return 'custom3';
    if (/^#[0-9a-f]{6}$/.test(value.trim())) return 'custom';
    return 'accent';
};

const mapTypographyTokenToTextOverrideToken = (token) => {
    if (token === 'textPrimary') return 'primary';
    if (token === 'textSecondary') return 'secondary';
    if (token === 'textTertiary') return 'tertiary';
    if (token === 'primary') return 'primary';
    if (token === 'secondary') return 'secondary';
    if (token === 'tertiary') return 'tertiary';
    if (token === 'accent') return 'accent';
    if (token === 'custom1') return 'custom1';
    if (token === 'custom2') return 'custom2';
    if (token === 'custom3') return 'custom3';
    return 'custom';
};

const resolveTypographyColor = (settings, mode, token, customColor) => {
    if (token === 'textPrimary') return settings.modeColors?.[mode]?.textPrimary || settings.modeColors.dark.textPrimary;
    if (token === 'textSecondary') return settings.modeColors?.[mode]?.textSecondary || settings.modeColors.dark.textSecondary;
    if (token === 'textTertiary') return settings.modeColors?.[mode]?.textTertiary || settings.modeColors.dark.textTertiary;
    if (token === 'primary') return settings.colors.primary;
    if (token === 'secondary') return settings.colors.secondary;
    if (token === 'tertiary') return settings.colors.tertiary;
    if (token === 'accent') return settings.colors.accent;
    if (token === 'custom1') return settings.colors.custom1;
    if (token === 'custom2') return settings.colors.custom2;
    if (token === 'custom3') return settings.colors.custom3;
    return customColor || settings.colors.accent;
};

const getTypographyColorMap = (settings, mode, customColor) => ({
    textPrimary: settings.modeColors?.[mode]?.textPrimary || settings.modeColors.dark.textPrimary,
    textSecondary: settings.modeColors?.[mode]?.textSecondary || settings.modeColors.dark.textSecondary,
    textTertiary: settings.modeColors?.[mode]?.textTertiary || settings.modeColors.dark.textTertiary,
    primary: settings.colors.primary,
    secondary: settings.colors.secondary,
    tertiary: settings.colors.tertiary,
    accent: settings.colors.accent,
    custom1: settings.colors.custom1,
    custom2: settings.colors.custom2,
    custom3: settings.colors.custom3,
    custom: customColor,
});

const resolveBrandTokenHex = (settings, token) => {
    if (token === 'primary') return settings.colors.primary;
    if (token === 'secondary') return settings.colors.secondary;
    if (token === 'tertiary') return settings.colors.tertiary;
    if (token === 'accent') return settings.colors.accent;
    if (token === 'custom1') return settings.colors.custom1;
    if (token === 'custom2') return settings.colors.custom2;
    if (token === 'custom3') return settings.colors.custom3;
    return settings.colors.accent;
};

const matchBrandTokenByHex = (settings, hex) => {
    const normalized = cleanHex(hex);
    if (!normalized) return 'accent';
    const matched = BRAND_TOKEN_OPTIONS.find((option) => resolveBrandTokenHex(settings, option.id) === normalized);
    return matched?.id || 'accent';
};

const getTypographyPresetPatch = (settings, presetId) => {
    if (presetId === 'link') {
        const smallStyle = settings.typeStyles?.small || DEFAULT_DESIGN_SETTINGS.typeStyles.small;
        return {
            fontId: settings.fonts?.ui || DEFAULT_DESIGN_SETTINGS.fonts.ui,
            size: settings.typography?.small || DEFAULT_DESIGN_SETTINGS.typography.small,
            unit: settings.typography?.unit || 'rem',
            weight: 500,
            lineHeight: smallStyle.lineHeight,
            letterSpacing: Math.max(0.01, smallStyle.letterSpacing),
            colorToken: 'accent',
            customColor: settings.colors?.accent || DEFAULT_DESIGN_SETTINGS.colors.accent,
        };
    }

    const token = TYPE_TOKENS.find((item) => item.id === presetId)?.id;
    if (!token) return null;
    const fontKey = TYPE_TOKEN_FONT_KEYS[token] || 'paragraph';
    const tokenStyle = settings.typeStyles?.[token] || DEFAULT_DESIGN_SETTINGS.typeStyles[token];

    return {
        fontId: settings.fonts?.[fontKey] || DEFAULT_DESIGN_SETTINGS.fonts[fontKey],
        size: settings.typography?.[token] || DEFAULT_DESIGN_SETTINGS.typography[token],
        unit: settings.typography?.unit || 'rem',
        weight: tokenStyle.weight,
        lineHeight: tokenStyle.lineHeight,
        letterSpacing: tokenStyle.letterSpacing,
        colorToken: tokenStyle.colorToken,
        customColor: tokenStyle.customColor,
    };
};

const ensureTextOverrideDefaults = (item) => ({
    id: item.id,
    selector: item.selector || '',
    route: item.route || '',
    enabled: false,
    fontId: inferFontId(item.fontFamily),
    size: Number(item.fontSize) > 0 ? Number(item.fontSize) : 1,
    unit: item.sizeUnit === 'em' ? 'em' : 'rem',
    weight: Number.isFinite(Number(item.fontWeight)) ? Number(item.fontWeight) : 500,
    lineHeight: Number(item.lineHeight) > 0 ? Number(item.lineHeight) : 1.35,
    letterSpacing: Number.isFinite(Number(item.letterSpacing)) ? Number(item.letterSpacing) : 0,
    colorToken: inferColorToken(item.color),
    customColor: cleanHex(item.color) || '#ff4d30',
});

function applyPreviewOverrideCss(settings) {
    if (typeof document === 'undefined') return;
    const cssText = designSettingsToTextOverrideCss(settings);
    const styleId = 'design-text-overrides-preview';
    const existing = document.getElementById(styleId);
    if (!cssText) {
        if (existing) existing.remove();
        return;
    }
    if (existing) {
        existing.textContent = cssText;
        return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = cssText;
    document.head.appendChild(style);
}

function applyCssVariables(settings) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars = designSettingsToCssVariables(settings);
    Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

function clearCssVariables() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    CSS_VARIABLE_KEYS.forEach((key) => {
        root.style.removeProperty(key);
    });
    document.getElementById('design-text-overrides-preview')?.remove();
}

export default function DesignManager() {
    const [settings, setSettings] = useState(() => cloneSettings(DEFAULT_DESIGN_SETTINGS));
    const [savedSettings, setSavedSettings] = useState(() => cloneSettings(DEFAULT_DESIGN_SETTINGS));
    const [presets, setPresets] = useState([]);
    const [presetName, setPresetName] = useState('');
    const [activeTab, setActiveTab] = useState('defaults');
    const [activeMode, setActiveMode] = useState('dark');
    const [loading, setLoading] = useState(true);
    const [loadingPresets, setLoadingPresets] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autosaving, setAutosaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [presetError, setPresetError] = useState('');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [busyPresetId, setBusyPresetId] = useState(null);
    const [scanLoading, setScanLoading] = useState(false);
    const [scanItems, setScanItems] = useState([]);
    const [scanFiltersMeta, setScanFiltersMeta] = useState({ focusAreas: [], pageGroups: [], routes: [] });
    const [scanFocusFilter, setScanFocusFilter] = useState('all');
    const [scanPageGroupFilter, setScanPageGroupFilter] = useState('all');
    const [scanRouteFilter, setScanRouteFilter] = useState('all');
    const [scanPreviewItemId, setScanPreviewItemId] = useState('');
    const [scanPreviewMessage, setScanPreviewMessage] = useState('Select a block to preview.');
    const [scanError, setScanError] = useState('');
    const [scanAt, setScanAt] = useState(null);
    const [activeTypeToken, setActiveTypeToken] = useState('h1');
    const [activeFeatureGroup, setActiveFeatureGroup] = useState(FEATURE_OVERRIDE_GROUPS[0].id);
    const [activeFeatureSlot, setActiveFeatureSlot] = useState(FEATURE_OVERRIDE_GROUPS[0].slots[0].id);
    const [activePageProfile, setActivePageProfile] = useState(PAGE_OVERRIDE_PROFILES[0].id);
    const [activePageTarget, setActivePageTarget] = useState(PAGE_OVERRIDE_PROFILES[0].targets[0].id);
    const [overrideScope, setOverrideScope] = useState('feature');

    const autosaveTimerRef = useRef(null);
    const livePreviewTimerRef = useRef(null);
    const previewChannelRef = useRef(null);
    const scanFrameRef = useRef(null);
    const hydratedRef = useRef(false);

    const fontMap = useMemo(() => {
        return FONT_OPTIONS.reduce((acc, option) => {
            acc[option.id] = option.stack;
            return acc;
        }, {});
    }, []);
    const fontLabelMap = useMemo(() => {
        return FONT_OPTIONS.reduce((acc, option) => {
            acc[option.id] = option.label;
            return acc;
        }, {});
    }, []);

    const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

    const modePreview = settings.modeColors[activeMode];
    const activeTypeConfig = TYPE_TOKENS.find((token) => token.id === activeTypeToken) || TYPE_TOKENS[0];
    const activeTypeStyles = settings.typeStyles?.[activeTypeToken] || DEFAULT_DESIGN_SETTINGS.typeStyles[activeTypeToken];
    const activeTypeFontKey = TYPE_TOKEN_FONT_KEYS[activeTypeToken] || 'paragraph';
    const activeTypeFontId = settings.fonts?.[activeTypeFontKey] || DEFAULT_DESIGN_SETTINGS.fonts.paragraph;
    const activeTypeColor = resolveTypographyColor(settings, activeMode, activeTypeStyles.colorToken, activeTypeStyles.customColor);
    const typographyColorMap = useMemo(
        () => getTypographyColorMap(settings, activeMode, activeTypeStyles.customColor),
        [activeMode, activeTypeStyles.customColor, settings],
    );
    const activeFeatureGroupConfig = FEATURE_OVERRIDE_GROUPS.find((group) => group.id === activeFeatureGroup) || FEATURE_OVERRIDE_GROUPS[0];
    const activeFeatureSlotConfig =
        activeFeatureGroupConfig.slots.find((slot) => slot.id === activeFeatureSlot) || activeFeatureGroupConfig.slots[0];
    const activeFeatureValue =
        settings.featureTypography?.[activeFeatureSlotConfig.id] || DEFAULT_DESIGN_SETTINGS.featureTypography[activeFeatureSlotConfig.id];
    const activeFeatureColor = resolveTypographyColor(
        settings,
        activeMode,
        activeFeatureValue.colorToken,
        activeFeatureValue.customColor,
    );
    const activeFeatureColorMap = useMemo(
        () => getTypographyColorMap(settings, activeMode, activeFeatureValue.customColor),
        [activeFeatureValue.customColor, activeMode, settings],
    );
    const activePageProfileConfig = PAGE_OVERRIDE_PROFILES.find((profile) => profile.id === activePageProfile) || PAGE_OVERRIDE_PROFILES[0];
    const activePageTargetConfig =
        activePageProfileConfig.targets.find((target) => target.id === activePageTarget) || activePageProfileConfig.targets[0];
    const activePageOverrideItem = useMemo(
        () => ({
            id: `page_override_${activePageProfileConfig.id}_${activePageTargetConfig.id}`,
            selector: activePageTargetConfig.selector,
            route: activePageProfileConfig.route || '',
            fontFamily: '',
            fontSize: settings.typography.paragraph,
            sizeUnit: settings.typography.unit,
            fontWeight: settings.typeStyles.paragraph.weight,
            lineHeight: settings.typeStyles.paragraph.lineHeight,
            letterSpacing: settings.typeStyles.paragraph.letterSpacing,
            color: settings.colors.accent,
        }),
        [activePageProfileConfig, activePageTargetConfig, settings],
    );
    const scanFilteredItems = useMemo(() => {
        return scanItems.filter((item) => {
            if (scanFocusFilter !== 'all' && item.focusArea !== scanFocusFilter) return false;
            if (scanPageGroupFilter !== 'all' && item.pageGroup !== scanPageGroupFilter) return false;
            if (scanRouteFilter !== 'all' && item.previewRoute !== scanRouteFilter) return false;
            return true;
        });
    }, [scanFocusFilter, scanItems, scanPageGroupFilter, scanRouteFilter]);

    const scanRouteOptions = useMemo(() => {
        const routeRows = Array.isArray(scanFiltersMeta.routes) ? scanFiltersMeta.routes : [];
        return routeRows.filter((row) => {
            if (scanPageGroupFilter === 'all') return true;
            return row.pageGroup === scanPageGroupFilter;
        });
    }, [scanFiltersMeta.routes, scanPageGroupFilter]);

    const activeScanPreviewItem = useMemo(() => {
        if (!scanFilteredItems.length) return null;
        if (scanPreviewItemId) {
            const selected = scanFilteredItems.find((item) => item.id === scanPreviewItemId);
            if (selected) return selected;
        }
        return scanFilteredItems[0];
    }, [scanFilteredItems, scanPreviewItemId]);

    const upsertGlobalSettings = async (nextSettings, options = { silent: false }) => {
        const normalized = normalizeDesignSettings(nextSettings);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('site_design_settings')
            .upsert(
                {
                    settings_key: SETTINGS_KEY,
                    settings: normalized,
                    updated_by: user?.id || null,
                },
                { onConflict: 'settings_key' },
            )
            .select('updated_at')
            .single();

        if (error) throw error;

        setSettings(cloneSettings(normalized));
        setSavedSettings(cloneSettings(normalized));
        setLastSavedAt(data?.updated_at || new Date().toISOString());
        if (!options.silent) setNotice(`Settings saved at ${formatDate(data?.updated_at)}`);

        return normalized;
    };

    const loadPresets = async () => {
        setLoadingPresets(true);
        setPresetError('');

        try {
            const { data, error } = await supabase
                .from('site_design_presets')
                .select('id, name, settings, created_at, updated_at')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setPresets(data || []);
        } catch (error) {
            const msg = String(error?.message || '');
            if (msg.includes('site_design_presets')) {
                setPresetError('Preset table missing. Run latest Supabase migrations to enable saved style states.');
            } else {
                setPresetError(msg || 'Failed to load presets.');
            }
        } finally {
            setLoadingPresets(false);
        }
    };

    useEffect(() => {
        let active = true;

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            previewChannelRef.current = new BroadcastChannel(PREVIEW_CHANNEL);
        }

        const load = async () => {
            setLoading(true);
            setErrorMsg('');

            try {
                const { data, error } = await supabase
                    .from('site_design_settings')
                    .select('settings, updated_at')
                    .eq('settings_key', SETTINGS_KEY)
                    .maybeSingle();

                if (error) throw error;

                const normalized = normalizeDesignSettings(data?.settings || DEFAULT_DESIGN_SETTINGS);
                if (!active) return;

                setSettings(cloneSettings(normalized));
                setSavedSettings(cloneSettings(normalized));
                setLastSavedAt(data?.updated_at || null);
                applyCssVariables(normalized);
                applyPreviewOverrideCss(normalized);
            } catch (error) {
                const msg = String(error?.message || '');
                if (msg.includes('site_design_settings')) {
                    setErrorMsg('Design settings table missing. Run latest Supabase migrations, then reload.');
                } else {
                    setErrorMsg(msg || 'Failed to load design settings.');
                }

                const fallback = cloneSettings(DEFAULT_DESIGN_SETTINGS);
                if (active) {
                    setSettings(fallback);
                    setSavedSettings(fallback);
                    applyCssVariables(fallback);
                    applyPreviewOverrideCss(fallback);
                }
            } finally {
                if (active) {
                    setLoading(false);
                    hydratedRef.current = true;
                }
            }
        };

        load();
        loadPresets();

        return () => {
            active = false;
            if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
            if (livePreviewTimerRef.current) window.clearTimeout(livePreviewTimerRef.current);
            try {
                localStorage.removeItem(PREVIEW_STORAGE_KEY);
            } catch (_error) {
                // no-op
            }
            previewChannelRef.current?.postMessage({ action: 'clear', keys: CSS_VARIABLE_KEYS, clearOverrides: true });
            previewChannelRef.current?.close();
            previewChannelRef.current = null;
            clearCssVariables();
        };
    }, []);

    useEffect(() => {
        if (loading) return;
        applyCssVariables(settings);
        applyPreviewOverrideCss(settings);
    }, [loading, settings]);

    useEffect(() => {
        if (loading) return;

        if (livePreviewTimerRef.current) window.clearTimeout(livePreviewTimerRef.current);
        livePreviewTimerRef.current = window.setTimeout(() => {
            const normalized = normalizeDesignSettings(settings);
            const payload = {
                vars: designSettingsToCssVariables(normalized),
                overrideCssText: designSettingsToTextOverrideCss(normalized),
                updatedAt: Date.now(),
            };

            try {
                localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload));
            } catch (_error) {
                // no-op
            }

            previewChannelRef.current?.postMessage(payload);
        }, LIVE_PREVIEW_DEBOUNCE_MS);

        return () => {
            if (livePreviewTimerRef.current) window.clearTimeout(livePreviewTimerRef.current);
        };
    }, [loading, settings]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(''), 2600);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (scanRouteFilter === 'all') return;
        const stillAvailable = scanRouteOptions.some((row) => row.route === scanRouteFilter);
        if (!stillAvailable) setScanRouteFilter('all');
    }, [scanRouteFilter, scanRouteOptions]);

    useEffect(() => {
        if (!scanFilteredItems.length) {
            setScanPreviewItemId('');
            setScanPreviewMessage('No text blocks match this filter.');
            return;
        }
        const selectedStillVisible = scanFilteredItems.some((item) => item.id === scanPreviewItemId);
        if (!selectedStillVisible) {
            setScanPreviewItemId(scanFilteredItems[0].id);
        }
    }, [scanFilteredItems, scanPreviewItemId]);

    useEffect(() => {
        const valid = activeFeatureGroupConfig.slots.some((slot) => slot.id === activeFeatureSlot);
        if (!valid) {
            setActiveFeatureSlot(activeFeatureGroupConfig.slots[0].id);
        }
    }, [activeFeatureGroupConfig, activeFeatureSlot]);

    useEffect(() => {
        const valid = activePageProfileConfig.targets.some((target) => target.id === activePageTarget);
        if (!valid) {
            setActivePageTarget(activePageProfileConfig.targets[0].id);
        }
    }, [activePageProfileConfig, activePageTarget]);

    useEffect(() => {
        if (activeTab !== 'textScan') return;
        if (!activeScanPreviewItem) return;
        const frame = scanFrameRef.current;
        if (!frame?.contentDocument) return;
        highlightScanPreviewInFrame(frame, activeScanPreviewItem);
    }, [activeTab, activeScanPreviewItem, settings]);

    useEffect(() => {
        if (!hydratedRef.current || loading) return;
        if (!settings.preferences.autoSave) return;
        if (!isDirty) return;

        if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = window.setTimeout(async () => {
            try {
                setAutosaving(true);
                await upsertGlobalSettings(settings, { silent: true });
            } catch (error) {
                setErrorMsg(error?.message || 'Autosave failed.');
            } finally {
                setAutosaving(false);
            }
        }, AUTOSAVE_DELAY_MS);

        return () => {
            if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
        };
    }, [isDirty, loading, settings, settings.preferences.autoSave]);

    const updateTypography = (key, value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        setSettings((current) => ({
            ...current,
            typography: {
                ...current.typography,
                [key]: parsed,
            },
        }));
    };

    const updateFont = (key, value) => {
        setSettings((current) => ({
            ...current,
            fonts: {
                ...current.fonts,
                [key]: value,
            },
        }));
    };

    const updateBrandColor = (key, value) => {
        const normalized = cleanHex(value);
        if (!normalized) return;
        setSettings((current) => ({
            ...current,
            colors: {
                ...current.colors,
                [key]: normalized,
            },
        }));
    };

    const updateModeColor = (mode, key, value) => {
        const normalized = cleanHex(value);
        if (!normalized) return;
        setSettings((current) => ({
            ...current,
            modeColors: {
                ...current.modeColors,
                [mode]: {
                    ...current.modeColors[mode],
                    [key]: normalized,
                },
            },
        }));
    };

    const setModeColorFromBrandToken = (mode, key, token) => {
        setSettings((current) => ({
            ...current,
            modeColors: {
                ...current.modeColors,
                [mode]: {
                    ...current.modeColors[mode],
                    [key]: resolveBrandTokenHex(current, token),
                },
            },
        }));
    };

    const updateLinkSettings = (key, value) => {
        setSettings((current) => ({
            ...current,
            links: {
                ...current.links,
                [key]: value,
            },
        }));
    };

    const updateRadius = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        setSettings((current) => ({
            ...current,
            radius: {
                ...current.radius,
                base: parsed,
            },
        }));
    };

    const updateAutoSave = (value) => {
        setSettings((current) => ({
            ...current,
            preferences: {
                ...current.preferences,
                autoSave: value,
            },
        }));
    };

    const setButtonStyle = (style) => {
        setSettings((current) => ({
            ...current,
            buttons: {
                ...current.buttons,
                style,
            },
        }));
    };

    const setUnit = (unit) => {
        setSettings((current) => ({
            ...current,
            typography: {
                ...current.typography,
                unit,
            },
        }));
    };

    const updateTypeStyle = (token, field, value) => {
        setSettings((current) => ({
            ...current,
            typeStyles: {
                ...current.typeStyles,
                [token]: {
                    ...(current.typeStyles?.[token] || DEFAULT_DESIGN_SETTINGS.typeStyles[token]),
                    [field]: value,
                },
            },
        }));
    };

    const updateFeatureTypography = (slot, field, value) => {
        setSettings((current) => ({
            ...current,
            featureTypography: {
                ...(current.featureTypography || {}),
                [slot]: {
                    ...(current.featureTypography?.[slot] || DEFAULT_DESIGN_SETTINGS.featureTypography[slot]),
                    [field]: value,
                },
            },
        }));
    };

    const applyTypePresetToFeature = (slotId, presetId) => {
        const preset = getTypographyPresetPatch(settings, presetId);
        if (!preset) return;
        setSettings((current) => ({
            ...current,
            featureTypography: {
                ...(current.featureTypography || {}),
                [slotId]: {
                    ...(current.featureTypography?.[slotId] || DEFAULT_DESIGN_SETTINGS.featureTypography[slotId]),
                    fontId: preset.fontId,
                    size: preset.size,
                    unit: preset.unit,
                    weight: preset.weight,
                    lineHeight: preset.lineHeight,
                    letterSpacing: preset.letterSpacing,
                    colorToken: preset.colorToken,
                    customColor: preset.customColor,
                },
            },
        }));
    };

    const ensureOverrideFromItem = (current, item) => {
        const existing = current.textOverrides?.[item.id];
        if (existing) return existing;
        return ensureTextOverrideDefaults(item);
    };

    const updateTextOverride = (item, patch) => {
        if (!item?.id) return;
        setSettings((current) => {
            const next = { ...ensureOverrideFromItem(current, item), ...patch };
            return {
                ...current,
                textOverrides: {
                    ...(current.textOverrides || {}),
                    [item.id]: next,
                },
            };
        });
    };

    const updatePageOverride = (patch) => {
        if (!activePageOverrideItem?.id) return;
        updateTextOverride(activePageOverrideItem, { enabled: true, ...patch });
    };

    const applyTypePresetToTextOverride = (item, presetId) => {
        const preset = getTypographyPresetPatch(settings, presetId);
        if (!preset) return;
        updateTextOverride(item, {
            enabled: true,
            fontId: preset.fontId,
            size: preset.size,
            unit: preset.unit,
            weight: preset.weight,
            lineHeight: preset.lineHeight,
            letterSpacing: preset.letterSpacing,
            colorToken: presetId === 'link' ? 'accent' : mapTypographyTokenToTextOverrideToken(preset.colorToken),
            customColor: preset.customColor,
        });
    };

    const resolveScanOverrideColor = (override) => {
        if (override.colorToken === 'primary') return settings.colors.primary;
        if (override.colorToken === 'secondary') return settings.colors.secondary;
        if (override.colorToken === 'tertiary') return settings.colors.tertiary;
        if (override.colorToken === 'accent') return settings.colors.accent;
        if (override.colorToken === 'custom1') return settings.colors.custom1;
        if (override.colorToken === 'custom2') return settings.colors.custom2;
        if (override.colorToken === 'custom3') return settings.colors.custom3;
        return override.customColor;
    };

    const getTextOverrideColorMap = (override) => ({
        primary: settings.colors.primary,
        secondary: settings.colors.secondary,
        tertiary: settings.colors.tertiary,
        accent: settings.colors.accent,
        custom1: settings.colors.custom1,
        custom2: settings.colors.custom2,
        custom3: settings.colors.custom3,
        custom: override?.customColor || settings.colors.accent,
    });

    const getScanSizePreset = (override) => {
        const unit = settings.typography.unit;
        const looksLikeLinkPreset =
            override.unit === unit &&
            Math.abs(Number(override.size) - Number(settings.typography.small)) < 0.005 &&
            override.fontId === (settings.fonts.ui || DEFAULT_DESIGN_SETTINGS.fonts.ui) &&
            override.colorToken === 'accent';
        if (looksLikeLinkPreset) return 'link';
        const matched = SCAN_SIZE_PRESETS.find((preset) => {
            const target = settings.typography[preset.id];
            return override.unit === unit && Math.abs(Number(override.size) - Number(target)) < 0.005;
        });
        return matched?.id || 'custom';
    };

    const getFeatureSizePreset = (featureSetting) => {
        const unit = settings.typography.unit;
        const looksLikeLinkPreset =
            featureSetting.unit === unit &&
            Math.abs(Number(featureSetting.size) - Number(settings.typography.small)) < 0.005 &&
            featureSetting.fontId === (settings.fonts.ui || DEFAULT_DESIGN_SETTINGS.fonts.ui) &&
            featureSetting.colorToken === 'accent';
        if (looksLikeLinkPreset) return 'link';
        const matched = SCAN_SIZE_PRESETS.find((preset) => {
            const target = settings.typography[preset.id];
            return featureSetting.unit === unit && Math.abs(Number(featureSetting.size) - Number(target)) < 0.005;
        });
        return matched?.id || 'custom';
    };

    const applyScanSizePreset = (item, presetId) => {
        if (presetId === 'custom') return;
        applyTypePresetToTextOverride(item, presetId);
    };

    const applyFeatureSizePreset = (slotId, presetId) => {
        if (presetId === 'custom') return;
        applyTypePresetToFeature(slotId, presetId);
    };

    const syncOverrideCssToFrame = (doc, styleId = 'admin-frame-overrides') => {
        if (!doc) return;
        const cssText = designSettingsToTextOverrideCss(settings);
        let styleNode = doc.getElementById(styleId);
        if (!cssText) {
            if (styleNode) styleNode.remove();
            return;
        }
        if (!styleNode) {
            styleNode = doc.createElement('style');
            styleNode.id = styleId;
            doc.head.appendChild(styleNode);
        }
        styleNode.textContent = cssText;
    };

    const highlightScanPreviewInFrame = (frame, item) => {
        if (!frame || !item) return;
        const doc = frame.contentDocument;
        if (!doc) return;

        syncOverrideCssToFrame(doc, 'admin-scan-preview-overrides');

        Array.from(doc.querySelectorAll('[data-admin-scan-highlight="true"]')).forEach((el) => {
            el.removeAttribute('data-admin-scan-highlight');
            el.style.removeProperty('outline');
            el.style.removeProperty('outline-offset');
            el.style.removeProperty('font-family');
            el.style.removeProperty('font-size');
            el.style.removeProperty('font-weight');
            el.style.removeProperty('line-height');
            el.style.removeProperty('letter-spacing');
            el.style.removeProperty('color');
        });

        const selector = item.previewSelector || item.selector;
        if (!selector) {
            setScanPreviewMessage('No selector available for this block.');
            return;
        }

        try {
            const nodes = Array.from(doc.querySelectorAll(selector)).slice(0, 4);
            if (!nodes.length) {
                setScanPreviewMessage(`This text block is not visible on ${item.previewRoute || item.route || '/'}.`);
                return;
            }
            const override = getOverrideForItem(item);
            const color = resolveScanOverrideColor(override);
            nodes.forEach((el) => {
                el.setAttribute('data-admin-scan-highlight', 'true');
                el.style.outline = '2px solid #ff4d30';
                el.style.outlineOffset = '2px';
                el.style.fontFamily = fontMap[override.fontId] || fontMap.satoshi;
                el.style.fontSize = `${override.size}${override.unit}`;
                el.style.fontWeight = String(override.weight);
                el.style.lineHeight = `${override.lineHeight}`;
                el.style.letterSpacing = `${override.letterSpacing}em`;
                el.style.color = color;
            });
            nodes[0].scrollIntoView({ behavior: 'auto', block: 'center' });
            setScanPreviewMessage(`Live preview on ${item.previewRoute || item.route || '/'}.`);
        } catch (_error) {
            setScanPreviewMessage('This text block cannot be previewed directly.');
        }
    };

    const handleScanTypography = async () => {
        try {
            setScanLoading(true);
            setScanError('');
            const response = await fetch('/api/admin/text-style-scan', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Scan failed (${response.status})`);
            }
            const payload = await response.json();
            const items = Array.isArray(payload?.items) ? payload.items.slice(0, TEXT_SCAN_LIMIT) : [];
            setScanItems(items);
            setScanFiltersMeta({
                focusAreas: Array.isArray(payload?.filters?.focusAreas) ? payload.filters.focusAreas : [],
                pageGroups: Array.isArray(payload?.filters?.pageGroups) ? payload.filters.pageGroups : [],
                routes: Array.isArray(payload?.filters?.routes) ? payload.filters.routes : [],
            });
            setScanFocusFilter('all');
            setScanPageGroupFilter('all');
            setScanRouteFilter('all');
            setScanPreviewItemId(items[0]?.id || '');
            setScanPreviewMessage(items[0] ? 'Preview ready. Select another block to inspect.' : 'No styled blocks found.');
            setScanAt(payload?.scannedAt || new Date().toISOString());
            setNotice(`Focused scan found ${items.length} key text blocks.`);

            setSettings((current) => {
                const merged = { ...(current.textOverrides || {}) };
                items.forEach((item) => {
                    if (!item?.id || !item?.selector) return;
                    if (!merged[item.id]) {
                        merged[item.id] = ensureTextOverrideDefaults(item);
                    }
                });
                return {
                    ...current,
                    textOverrides: merged,
                };
            });
        } catch (error) {
            setScanError(error?.message || 'Failed to scan typography styles.');
        } finally {
            setScanLoading(false);
        }
    };

    const getOverrideForItem = (item) => {
        const existing = settings.textOverrides?.[item.id];
        if (existing) return existing;
        return ensureTextOverrideDefaults(item);
    };
    const activePageOverride = activePageOverrideItem ? getOverrideForItem(activePageOverrideItem) : null;
    const activePageOverrideColorMap = activePageOverride ? getTextOverrideColorMap(activePageOverride) : null;

    const handleManualSave = async () => {
        try {
            setSaving(true);
            setErrorMsg('');
            await upsertGlobalSettings(settings);
        } catch (error) {
            setErrorMsg(error?.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleRevertSaved = () => {
        const reverted = cloneSettings(savedSettings);
        setSettings(reverted);
        setNotice('Reverted unsaved changes.');
    };

    const handleResetDefaults = () => {
        const defaults = cloneSettings(DEFAULT_DESIGN_SETTINGS);
        setSettings(defaults);
        setNotice('Reset to defaults. Save or keep autosave on to apply globally.');
    };

    const handleCreatePreset = async () => {
        const trimmedName = presetName.trim();
        if (!trimmedName) {
            setPresetError('Preset name is required.');
            return;
        }

        setPresetError('');
        setBusyPresetId('new');

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const { error } = await supabase.from('site_design_presets').insert({
                name: trimmedName,
                settings: normalizeDesignSettings(settings),
                created_by: user?.id || null,
                updated_by: user?.id || null,
            });

            if (error) throw error;
            setPresetName('');
            await loadPresets();
            setNotice(`Preset "${trimmedName}" saved.`);
        } catch (error) {
            setPresetError(error?.message || 'Failed to create preset.');
        } finally {
            setBusyPresetId(null);
        }
    };

    const handleApplyPreset = async (preset) => {
        setPresetError('');
        setBusyPresetId(preset.id);

        try {
            const normalized = normalizeDesignSettings(preset.settings);
            setSettings(cloneSettings(normalized));
            await upsertGlobalSettings(normalized, { silent: true });
            setNotice(`Applied preset "${preset.name}" at ${formatDate(new Date().toISOString())}`);
        } catch (error) {
            setPresetError(error?.message || 'Failed to apply preset.');
        } finally {
            setBusyPresetId(null);
        }
    };

    const handleOverwritePreset = async (preset) => {
        setPresetError('');
        setBusyPresetId(preset.id);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('site_design_presets')
                .update({
                    settings: normalizeDesignSettings(settings),
                    updated_by: user?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', preset.id);

            if (error) throw error;
            await loadPresets();
            setNotice(`Preset "${preset.name}" updated.`);
        } catch (error) {
            setPresetError(error?.message || 'Failed to overwrite preset.');
        } finally {
            setBusyPresetId(null);
        }
    };

    const handleDeletePreset = async (preset) => {
        if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
        setPresetError('');
        setBusyPresetId(preset.id);

        try {
            const { error } = await supabase.from('site_design_presets').delete().eq('id', preset.id);
            if (error) throw error;
            await loadPresets();
            setNotice(`Preset "${preset.name}" deleted.`);
        } catch (error) {
            setPresetError(error?.message || 'Failed to delete preset.');
        } finally {
            setBusyPresetId(null);
        }
    };

    if (loading) {
        return (
            <div className="design-loading">
                Loading design controls...
                <style>{`
                    .design-loading {
                        color: var(--text-secondary);
                        font-size: 0.9rem;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="design-manager">
            <div className="studio-sticky-shell">
                <header className="design-header">
                    <div className="design-header-copy">
                        <h2>Design Studio</h2>
                        <p>Set defaults first, then override exact targets only when needed.</p>
                    </div>

                    <div className="design-header-actions">
                        <div className="mode-sticky-switch">
                            <span className="mode-sticky-label">Editing Mode</span>
                            <div className="sub-pills">
                                {MODE_OPTIONS.map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        className={`pill mini ${activeMode === mode.id ? 'active' : ''}`}
                                        onClick={() => setActiveMode(mode.id)}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="autosave-toggle">
                            <input
                                type="checkbox"
                                checked={settings.preferences.autoSave}
                                onChange={(event) => updateAutoSave(event.target.checked)}
                            />
                            <span>Autosave</span>
                        </label>

                        <button type="button" className="btn-secondary-action" disabled={!isDirty || saving || autosaving} onClick={handleRevertSaved}>
                            Revert
                        </button>
                        <button type="button" className="btn-secondary-action" disabled={saving || autosaving} onClick={handleResetDefaults}>
                            Reset
                        </button>
                        <button type="button" className="btn-primary-action" disabled={saving || autosaving || !isDirty} onClick={handleManualSave}>
                            {saving ? 'Saving...' : 'Save Now'}
                        </button>
                    </div>
                </header>

                <div className="status-bar">
                    <span className={isDirty ? 'dirty' : 'clean'}>{isDirty ? 'Unsaved changes' : 'All changes synced'}</span>
                    <span>{autosaving ? 'Autosaving...' : `Last saved: ${formatDate(lastSavedAt)}`}</span>
                </div>

                <div className="pill-nav" role="tablist" aria-label="Design sections">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`pill ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {errorMsg && <div className="alert error">{errorMsg}</div>}
            {notice && <div className="alert success">{notice}</div>}
            {presetError && <div className="alert error">{presetError}</div>}

            <div className="tab-panel">
                {activeTab === 'defaults' && (
                    <section className="panel defaults-section">
                        <div className="panel-head">
                            <div>
                                <h3>Typography Defaults</h3>
                                <p className="panel-hint">
                                    Set your base typography tokens and defaults. Currently editing{' '}
                                    <strong>{activeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>.
                                </p>
                            </div>
                            <div className="unit-toggle">
                                <button type="button" className={settings.typography.unit === 'rem' ? 'active' : ''} onClick={() => setUnit('rem')}>
                                    REM
                                </button>
                                <button type="button" className={settings.typography.unit === 'em' ? 'active' : ''} onClick={() => setUnit('em')}>
                                    EM
                                </button>
                            </div>
                        </div>

                        <div className="type-studio-grid">
                            <div className="type-token-list">
                                {TYPE_TOKENS.map((token) => (
                                    <button
                                        key={token.id}
                                        type="button"
                                        className={`type-token-btn ${activeTypeToken === token.id ? 'active' : ''}`}
                                        onClick={() => setActiveTypeToken(token.id)}
                                    >
                                        <span>{token.label}</span>
                                        <strong>
                                            {settings.typography[token.id].toFixed(2)}
                                            {settings.typography.unit}
                                        </strong>
                                    </button>
                                ))}
                            </div>

                            <div className="type-inspector">
                                <label className="field-control">
                                    <span>Font Family</span>
                                    <select value={activeTypeFontId} onChange={(event) => updateFont(activeTypeFontKey, event.target.value)}>
                                        {FONT_OPTIONS.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="slider-control">
                                    <span className="control-label">
                                        Size
                                        <strong>
                                            {settings.typography[activeTypeToken].toFixed(2)}
                                            {settings.typography.unit}
                                        </strong>
                                    </span>
                                    <input
                                        type="range"
                                        min={activeTypeConfig.min}
                                        max={activeTypeConfig.max}
                                        step={activeTypeConfig.step}
                                        value={settings.typography[activeTypeToken]}
                                        onChange={(event) => updateTypography(activeTypeToken, event.target.value)}
                                    />
                                </label>

                                <label className="slider-control">
                                    <span className="control-label">
                                        Weight
                                        <strong>{activeTypeStyles.weight}</strong>
                                    </span>
                                    <input
                                        type="range"
                                        min="100"
                                        max="900"
                                        step="100"
                                        value={activeTypeStyles.weight}
                                        onChange={(event) => updateTypeStyle(activeTypeToken, 'weight', Number(event.target.value) || 400)}
                                    />
                                </label>

                                <label className="slider-control">
                                    <span className="control-label">
                                        Line Height
                                        <strong>{activeTypeStyles.lineHeight.toFixed(2)}</strong>
                                    </span>
                                    <input
                                        type="range"
                                        min="0.8"
                                        max="2.4"
                                        step="0.01"
                                        value={activeTypeStyles.lineHeight}
                                        onChange={(event) => updateTypeStyle(activeTypeToken, 'lineHeight', Number(event.target.value) || 1.2)}
                                    />
                                </label>

                                <label className="slider-control">
                                    <span className="control-label">
                                        Letter Spacing
                                        <strong>{activeTypeStyles.letterSpacing.toFixed(3)}em</strong>
                                    </span>
                                    <input
                                        type="range"
                                        min="-0.2"
                                        max="0.2"
                                        step="0.005"
                                        value={activeTypeStyles.letterSpacing}
                                        onChange={(event) => updateTypeStyle(activeTypeToken, 'letterSpacing', Number(event.target.value) || 0)}
                                    />
                                </label>

                                <div className="type-color-block">
                                    <span className="type-color-title">Color Source</span>

                                    <div className="type-color-swatches" role="listbox" aria-label="Typography color source">
                                        {TYPOGRAPHY_COLOR_OPTIONS.map((option) => {
                                            const swatch = typographyColorMap[option.id] || settings.colors.accent;
                                            const selected = activeTypeStyles.colorToken === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selected}
                                                    className={`type-color-swatch-btn ${selected ? 'active' : ''}`}
                                                    onClick={() => updateTypeStyle(activeTypeToken, 'colorToken', option.id)}
                                                >
                                                    <span className="type-color-dot" style={{ background: swatch }} />
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <label className="color-control type-color-custom">
                                        <span>Quick Color Pick</span>
                                        <div className="color-input-wrap">
                                            <input
                                                type="color"
                                                value={activeTypeStyles.customColor}
                                                onChange={(event) => {
                                                    updateTypeStyle(activeTypeToken, 'customColor', event.target.value);
                                                    updateTypeStyle(activeTypeToken, 'colorToken', 'custom');
                                                }}
                                            />
                                            <input
                                                type="text"
                                                value={activeTypeStyles.customColor}
                                                onChange={(event) => {
                                                    const value = cleanHex(event.target.value);
                                                    if (!value) return;
                                                    updateTypeStyle(activeTypeToken, 'customColor', value);
                                                    updateTypeStyle(activeTypeToken, 'colorToken', 'custom');
                                                }}
                                            />
                                        </div>
                                    </label>

                                    {activeTypeStyles.colorToken === 'custom' && (
                                        <label className="color-control type-color-custom">
                                            <span>Custom Color</span>
                                            <div className="color-input-wrap">
                                                <input
                                                    type="color"
                                                    value={activeTypeStyles.customColor}
                                                    onChange={(event) => updateTypeStyle(activeTypeToken, 'customColor', event.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    value={activeTypeStyles.customColor}
                                                    onChange={(event) => {
                                                        const value = cleanHex(event.target.value);
                                                        if (!value) return;
                                                        updateTypeStyle(activeTypeToken, 'customColor', value);
                                                    }}
                                                />
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="type-preview-stage">
                            <p className="preview-caption">{activeTypeConfig.label} Preview</p>
                            <div
                                className="type-preview-sample"
                                style={{
                                    fontFamily: fontMap[activeTypeFontId] || fontMap.satoshi,
                                    fontSize: `${settings.typography[activeTypeToken]}${settings.typography.unit}`,
                                    fontWeight: activeTypeStyles.weight,
                                    lineHeight: activeTypeStyles.lineHeight,
                                    letterSpacing: `${activeTypeStyles.letterSpacing}em`,
                                    color: activeTypeColor,
                                    textTransform: activeTypeToken === 'custom2' ? 'uppercase' : 'none',
                                }}
                            >
                                {activeTypeConfig.sample}
                            </div>
                        </div>

                        <div className="type-reference-list">
                            {TYPE_TOKENS.map((token) => {
                                const tokenStyles = settings.typeStyles?.[token.id] || DEFAULT_DESIGN_SETTINGS.typeStyles[token.id];
                                const tokenFontId = settings.fonts[TYPE_TOKEN_FONT_KEYS[token.id]] || settings.fonts.paragraph;
                                const tokenColor = resolveTypographyColor(settings, activeMode, tokenStyles.colorToken, tokenStyles.customColor);

                                return (
                                    <div key={token.id} className="affected-item">
                                        <span className="affected-kicker">{token.label}</span>
                                        <div
                                            className="type-reference-sample"
                                            style={{
                                                fontFamily: fontMap[tokenFontId] || fontMap.satoshi,
                                                fontSize: `${settings.typography[token.id]}${settings.typography.unit}`,
                                                fontWeight: tokenStyles.weight,
                                                lineHeight: tokenStyles.lineHeight,
                                                letterSpacing: `${tokenStyles.letterSpacing}em`,
                                                color: tokenColor,
                                                textTransform: token.id === 'custom2' ? 'uppercase' : 'none',
                                            }}
                                        >
                                            {token.sample}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </section>
                )}

                {activeTab === 'overrides' && (
                    <section className="panel">
                        <div className="panel-head">
                            <div>
                                <h3>Design Override Studio</h3>
                                <p className="panel-hint">Set Default Values defines base tokens. Use this studio to override exact sections and page elements.</p>
                            </div>
                            <div className="sub-pills">
                                {OVERRIDE_SCOPE_OPTIONS.map((scope) => (
                                    <button
                                        key={scope.id}
                                        type="button"
                                        className={`pill mini ${overrideScope === scope.id ? 'active' : ''}`}
                                        onClick={() => setOverrideScope(scope.id)}
                                    >
                                        {scope.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="feature-typography-section" style={{ display: overrideScope === 'feature' ? 'grid' : 'none' }}>
                            <div className="panel-head">
                                <div>
                                    <h3>Feature Override Studio</h3>
                                    <p className="panel-hint">Override reusable feature blocks like typewriter, stack, newsletter, and Obsidian modules.</p>
                                </div>
                            </div>

                            <div className="scan-pills">
                                {FEATURE_OVERRIDE_GROUPS.map((group) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        className={`pill mini ${activeFeatureGroup === group.id ? 'active' : ''}`}
                                        onClick={() => setActiveFeatureGroup(group.id)}
                                    >
                                        {group.label}
                                    </button>
                                ))}
                            </div>

                            <p className="panel-hint">{activeFeatureGroupConfig.hint}</p>

                            <div className="feature-override-studio">
                                <div className="feature-override-list">
                                    {activeFeatureGroupConfig.slots.map((slot) => {
                                        const isActive = activeFeatureSlotConfig.id === slot.id;
                                        return (
                                            <button
                                                key={slot.id}
                                                type="button"
                                                className={`feature-override-item ${isActive ? 'active' : ''}`}
                                                onClick={() => setActiveFeatureSlot(slot.id)}
                                            >
                                                <span className="feature-override-item-label">{slot.label}</span>
                                                <span className="feature-override-item-target">{slot.target}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="feature-override-inspector">
                                    <div className="feature-type-head">
                                        <strong>{activeFeatureSlotConfig.label}</strong>
                                        <span>{activeFeatureSlotConfig.target}</span>
                                    </div>

                                    <div className="type-inspector">
                                        <label className="field-control">
                                            <span>Font Family</span>
                                            <select
                                                value={activeFeatureValue.fontId}
                                                onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'fontId', event.target.value)}
                                            >
                                                {FONT_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="field-control">
                                            <span>Type Preset</span>
                                            <select
                                                value={getFeatureSizePreset(activeFeatureValue)}
                                                onChange={(event) => applyFeatureSizePreset(activeFeatureSlotConfig.id, event.target.value)}
                                            >
                                                <option value="custom">Manual</option>
                                                {TYPE_PRESET_OPTIONS.map((preset) => (
                                                    <option key={preset.id} value={preset.id}>
                                                        {preset.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <div className="mini-unit-toggle">
                                            <button
                                                type="button"
                                                className={activeFeatureValue.unit === 'rem' ? 'active' : ''}
                                                onClick={() => updateFeatureTypography(activeFeatureSlotConfig.id, 'unit', 'rem')}
                                            >
                                                REM
                                            </button>
                                            <button
                                                type="button"
                                                className={activeFeatureValue.unit === 'em' ? 'active' : ''}
                                                onClick={() => updateFeatureTypography(activeFeatureSlotConfig.id, 'unit', 'em')}
                                            >
                                                EM
                                            </button>
                                        </div>

                                        <label className="slider-control">
                                            <span className="control-label">
                                                Size
                                                <strong>
                                                    {Number(activeFeatureValue.size).toFixed(2)}
                                                    {activeFeatureValue.unit}
                                                </strong>
                                            </span>
                                            <input
                                                type="range"
                                                min={activeFeatureSlotConfig.min}
                                                max={activeFeatureSlotConfig.max}
                                                step={activeFeatureSlotConfig.step}
                                                value={activeFeatureValue.size}
                                                onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'size', Number(event.target.value) || 1)}
                                            />
                                        </label>

                                        <label className="slider-control">
                                            <span className="control-label">
                                                Weight
                                                <strong>{activeFeatureValue.weight}</strong>
                                            </span>
                                            <input
                                                type="range"
                                                min="100"
                                                max="900"
                                                step="100"
                                                value={activeFeatureValue.weight}
                                                onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'weight', Number(event.target.value) || 400)}
                                            />
                                        </label>

                                        <label className="slider-control">
                                            <span className="control-label">
                                                Line Height
                                                <strong>{Number(activeFeatureValue.lineHeight).toFixed(2)}</strong>
                                            </span>
                                            <input
                                                type="range"
                                                min="0.8"
                                                max="2.4"
                                                step="0.01"
                                                value={activeFeatureValue.lineHeight}
                                                onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'lineHeight', Number(event.target.value) || 1.2)}
                                            />
                                        </label>

                                        <label className="slider-control">
                                            <span className="control-label">
                                                Letter Spacing
                                                <strong>{Number(activeFeatureValue.letterSpacing).toFixed(3)}em</strong>
                                            </span>
                                            <input
                                                type="range"
                                                min="-0.2"
                                                max="0.2"
                                                step="0.005"
                                                value={activeFeatureValue.letterSpacing}
                                                onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'letterSpacing', Number(event.target.value) || 0)}
                                            />
                                        </label>

                                        <div className="type-color-block">
                                            <span className="type-color-title">Color Source</span>
                                            <div className="type-color-swatches" role="listbox" aria-label={`${activeFeatureSlotConfig.label} color source`}>
                                                {TYPOGRAPHY_COLOR_OPTIONS.map((option) => {
                                                    const swatch = activeFeatureColorMap[option.id] || settings.colors.accent;
                                                    const selected = activeFeatureValue.colorToken === option.id;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={selected}
                                                            className={`type-color-swatch-btn ${selected ? 'active' : ''}`}
                                                            onClick={() => updateFeatureTypography(activeFeatureSlotConfig.id, 'colorToken', option.id)}
                                                        >
                                                            <span className="type-color-dot" style={{ background: swatch }} />
                                                            <span>{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {activeFeatureValue.colorToken === 'custom' && (
                                                <label className="color-control type-color-custom">
                                                    <span>Custom Color</span>
                                                    <div className="color-input-wrap">
                                                        <input
                                                            type="color"
                                                            value={activeFeatureValue.customColor}
                                                            onChange={(event) => updateFeatureTypography(activeFeatureSlotConfig.id, 'customColor', event.target.value)}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={activeFeatureValue.customColor}
                                                            onChange={(event) => {
                                                                const next = cleanHex(event.target.value);
                                                                if (!next) return;
                                                                updateFeatureTypography(activeFeatureSlotConfig.id, 'customColor', next);
                                                            }}
                                                        />
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="type-preview-stage">
                                        <p className="preview-caption">Feature Preview</p>
                                        <div
                                            className="type-preview-sample"
                                            style={{
                                                fontFamily: fontMap[activeFeatureValue.fontId] || fontMap.satoshi,
                                                fontSize: `${activeFeatureValue.size}${activeFeatureValue.unit}`,
                                                fontWeight: activeFeatureValue.weight,
                                                lineHeight: activeFeatureValue.lineHeight,
                                                letterSpacing: `${activeFeatureValue.letterSpacing}em`,
                                                color: activeFeatureColor,
                                            }}
                                        >
                                            {activeFeatureSlotConfig.sample}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="feature-typography-section" style={{ display: overrideScope === 'page' ? 'grid' : 'none' }}>
                            <div className="panel-head">
                                <div>
                                    <h3>Page Override Studio</h3>
                                    <p className="panel-hint">Major-page micro controls for headings, menus, body copy, metadata, and links.</p>
                                </div>
                            </div>

                            <div className="scan-pills">
                                {PAGE_OVERRIDE_PROFILES.map((profile) => (
                                    <button
                                        key={profile.id}
                                        type="button"
                                        className={`pill mini ${activePageProfile === profile.id ? 'active' : ''}`}
                                        onClick={() => setActivePageProfile(profile.id)}
                                    >
                                        {profile.label}
                                    </button>
                                ))}
                            </div>

                            <p className="panel-hint">{activePageProfileConfig.hint}</p>

                            <div className="feature-override-studio">
                                <div className="feature-override-list">
                                    {activePageProfileConfig.targets.map((target) => {
                                        const isActive = activePageTargetConfig.id === target.id;
                                        return (
                                            <button
                                                key={target.id}
                                                type="button"
                                                className={`feature-override-item ${isActive ? 'active' : ''}`}
                                                onClick={() => setActivePageTarget(target.id)}
                                            >
                                                <span className="feature-override-item-label">{target.label}</span>
                                                <span className="feature-override-item-target">{target.selector}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="feature-override-inspector">
                                    <div className="feature-type-head">
                                        <strong>{activePageTargetConfig.label}</strong>
                                        <span>{activePageTargetConfig.selector}</span>
                                        <span>{activePageProfileConfig.route ? `Route: ${activePageProfileConfig.route}` : 'Route: Global selector scope'}</span>
                                    </div>

                                    {activePageOverride && (
                                        <>
                                            <div className="type-inspector">
                                                <label className="field-control">
                                                    <span>Font Family</span>
                                                    <select
                                                        value={activePageOverride.fontId}
                                                        onChange={(event) => updatePageOverride({ fontId: event.target.value })}
                                                    >
                                                        {FONT_OPTIONS.map((option) => (
                                                            <option key={option.id} value={option.id}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="field-control">
                                                    <span>Type Preset</span>
                                                    <select
                                                        value={getScanSizePreset(activePageOverride)}
                                                        onChange={(event) => {
                                                            applyScanSizePreset(activePageOverrideItem, event.target.value);
                                                        }}
                                                    >
                                                        <option value="custom">Manual</option>
                                                        {TYPE_PRESET_OPTIONS.map((preset) => (
                                                            <option key={preset.id} value={preset.id}>
                                                                {preset.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="slider-control">
                                                    <span className="control-label">
                                                        Size
                                                        <strong>
                                                            {Number(activePageOverride.size).toFixed(2)}
                                                            {activePageOverride.unit}
                                                        </strong>
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="0.5"
                                                        max="8"
                                                        step="0.01"
                                                        value={activePageOverride.size}
                                                        onChange={(event) => updatePageOverride({ size: Number(event.target.value) || 1 })}
                                                    />
                                                </label>

                                                <label className="slider-control">
                                                    <span className="control-label">
                                                        Weight
                                                        <strong>{activePageOverride.weight}</strong>
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="100"
                                                        max="900"
                                                        step="100"
                                                        value={activePageOverride.weight}
                                                        onChange={(event) => updatePageOverride({ weight: Number(event.target.value) || 500 })}
                                                    />
                                                </label>

                                                <label className="slider-control">
                                                    <span className="control-label">
                                                        Line Height
                                                        <strong>{Number(activePageOverride.lineHeight).toFixed(2)}</strong>
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="0.8"
                                                        max="2.4"
                                                        step="0.01"
                                                        value={activePageOverride.lineHeight}
                                                        onChange={(event) => updatePageOverride({ lineHeight: Number(event.target.value) || 1.3 })}
                                                    />
                                                </label>

                                                <label className="slider-control">
                                                    <span className="control-label">
                                                        Letter Spacing
                                                        <strong>{Number(activePageOverride.letterSpacing).toFixed(3)}em</strong>
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="-0.2"
                                                        max="0.2"
                                                        step="0.005"
                                                        value={activePageOverride.letterSpacing}
                                                        onChange={(event) => updatePageOverride({ letterSpacing: Number(event.target.value) || 0 })}
                                                    />
                                                </label>

                                                <div className="type-color-block">
                                                    <span className="type-color-title">Color Source</span>
                                                    <div className="type-color-swatches" role="listbox" aria-label={`${activePageTargetConfig.label} color source`}>
                                                        {TEXT_COLOR_OPTIONS.map((option) => {
                                                            const swatch = activePageOverrideColorMap?.[option.id] || settings.colors.accent;
                                                            const selected = activePageOverride.colorToken === option.id;
                                                            return (
                                                                <button
                                                                    key={option.id}
                                                                    type="button"
                                                                    role="option"
                                                                    aria-selected={selected}
                                                                    className={`type-color-swatch-btn ${selected ? 'active' : ''}`}
                                                                    onClick={() => updatePageOverride({ colorToken: option.id })}
                                                                >
                                                                    <span className="type-color-dot" style={{ background: swatch }} />
                                                                    <span>{option.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {activePageOverride.colorToken === 'custom' && (
                                                        <label className="color-control type-color-custom">
                                                            <span>Custom Color</span>
                                                            <div className="color-input-wrap">
                                                                <input
                                                                    type="color"
                                                                    value={activePageOverride.customColor}
                                                                    onChange={(event) => updatePageOverride({ customColor: event.target.value })}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={activePageOverride.customColor}
                                                                    onChange={(event) => {
                                                                        const value = cleanHex(event.target.value);
                                                                        if (!value) return;
                                                                        updatePageOverride({ customColor: value });
                                                                    }}
                                                                />
                                                            </div>
                                                        </label>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="type-preview-stage">
                                                <p className="preview-caption">Page Override Preview</p>
                                                <div
                                                    className="type-preview-sample"
                                                    style={{
                                                        fontFamily: fontMap[activePageOverride.fontId] || fontMap.satoshi,
                                                        fontSize: `${activePageOverride.size}${activePageOverride.unit}`,
                                                        fontWeight: activePageOverride.weight,
                                                        lineHeight: activePageOverride.lineHeight,
                                                        letterSpacing: `${activePageOverride.letterSpacing}em`,
                                                        color: resolveScanOverrideColor(activePageOverride),
                                                    }}
                                                >
                                                    {activePageTargetConfig.sample}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {false && (
                    <section className="panel">
                        <div className="panel-head">
                            <div>
                                <h3>Focused Text Scan</h3>
                                <p className="panel-hint">Prioritizes header/menu, card stacks, titles/buttons, body, footer, and page content zones.</p>
                            </div>
                            <button type="button" className="btn-primary-action" onClick={handleScanTypography} disabled={scanLoading}>
                                {scanLoading ? 'Scanning...' : 'Scan Typography'}
                            </button>
                        </div>
                        {scanAt && <p className="panel-hint">Last scan: {formatDate(scanAt)}</p>}
                        {scanError && <div className="alert error">{scanError}</div>}

                        {scanItems.length === 0 ? (
                            <p className="panel-hint">Run scan to load styled text blocks.</p>
                        ) : (
                            <>
                                <div className="scan-filters">
                                <div className="scan-pills">
                                    {SCAN_FOCUS_FILTERS.filter((pill) => {
                                        if (pill.id === 'all') return true;
                                        return scanFiltersMeta.focusAreas.some((item) => item.id === pill.id);
                                    }).map((pill) => (
                                        <button
                                            key={pill.id}
                                            type="button"
                                            className={`pill mini ${scanFocusFilter === pill.id ? 'active' : ''}`}
                                            onClick={() => setScanFocusFilter(pill.id)}
                                        >
                                            {pill.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="scan-pills">
                                    {SCAN_PAGE_GROUPS.filter((pill) => {
                                        if (pill.id === 'all') return true;
                                        return scanFiltersMeta.pageGroups.some((item) => item.id === pill.id);
                                    }).map((pill) => (
                                        <button
                                            key={pill.id}
                                            type="button"
                                            className={`pill mini ${scanPageGroupFilter === pill.id ? 'active' : ''}`}
                                            onClick={() => setScanPageGroupFilter(pill.id)}
                                        >
                                            {pill.label}
                                        </button>
                                    ))}
                                </div>

                                <label className="field-control scan-route-select">
                                    <span>Major Page Route</span>
                                    <select value={scanRouteFilter} onChange={(event) => setScanRouteFilter(event.target.value)}>
                                        <option value="all">All routes</option>
                                        {scanRouteOptions.map((row) => (
                                            <option key={row.route} value={row.route}>
                                                {row.route} ({row.count})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                                <div className="scan-workbench">
                                <div className="scan-list">
                                    {scanFilteredItems.map((item) => {
                                        const override = getOverrideForItem(item);
                                        const isActivePreview = activeScanPreviewItem?.id === item.id;
                                        return (
                                            <article key={item.id} className={`scan-card ${isActivePreview ? 'is-previewing' : ''}`}>
                                                <div className="scan-card-head">
                                                    <div className="scan-meta">
                                                        <strong>{item.focusLabel || 'Text Block'}</strong>
                                                        <span>{item.previewRoute || item.route || '/'}</span>
                                                        <div
                                                            className="scan-mini-type"
                                                            style={{
                                                                fontFamily: fontMap[override.fontId] || fontMap.satoshi,
                                                                color: resolveScanOverrideColor(override),
                                                            }}
                                                        >
                                                            <span className="scan-mini-aa">Aa</span>
                                                            <span className="scan-mini-font">{fontLabelMap[override.fontId] || 'Font'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="scan-card-actions">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary-action"
                                                            onClick={() => setScanPreviewItemId(item.id)}
                                                        >
                                                            Preview
                                                        </button>
                                                        <a className="scan-link" href={item.previewRoute || item.route || '/'} target="_blank" rel="noreferrer">
                                                            Open Page
                                                        </a>
                                                    </div>
                                                </div>

                                                <div className="scan-controls">
                                                    <label className="check-control">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(override.enabled)}
                                                            onChange={(event) => updateTextOverride(item, { enabled: event.target.checked })}
                                                        />
                                                        <span>Enable override</span>
                                                    </label>

                                                    <label className="field-control">
                                                        <span>Font</span>
                                                        <select
                                                            value={override.fontId}
                                                            onChange={(event) => updateTextOverride(item, { fontId: event.target.value })}
                                                        >
                                                            {FONT_OPTIONS.map((option) => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>

                                                    <label className="field-control">
                                                        <span>Type Preset</span>
                                                        <select
                                                            value={getScanSizePreset(override)}
                                                            onChange={(event) => applyScanSizePreset(item, event.target.value)}
                                                        >
                                                            <option value="custom">Manual</option>
                                                            {TYPE_PRESET_OPTIONS.map((preset) => (
                                                                <option key={preset.id} value={preset.id}>
                                                                    {preset.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>

                                                    <label className="slider-control">
                                                        <span className="control-label">
                                                            Size
                                                            <strong>{Number(override.size).toFixed(2)}{override.unit}</strong>
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="0.5"
                                                            max="8"
                                                            step="0.01"
                                                            value={override.size}
                                                            onChange={(event) => updateTextOverride(item, { size: Number(event.target.value) || 1 })}
                                                        />
                                                    </label>

                                                    <label className="slider-control">
                                                        <span className="control-label">
                                                            Weight
                                                            <strong>{override.weight}</strong>
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="100"
                                                            max="900"
                                                            step="100"
                                                            value={override.weight}
                                                            onChange={(event) => updateTextOverride(item, { weight: Number(event.target.value) || 500 })}
                                                        />
                                                    </label>

                                                    <label className="slider-control">
                                                        <span className="control-label">
                                                            Line Height
                                                            <strong>{Number(override.lineHeight).toFixed(2)}</strong>
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="0.8"
                                                            max="2.4"
                                                            step="0.01"
                                                            value={override.lineHeight}
                                                            onChange={(event) => updateTextOverride(item, { lineHeight: Number(event.target.value) || 1.3 })}
                                                        />
                                                    </label>

                                                    <label className="slider-control">
                                                        <span className="control-label">
                                                            Letter Spacing
                                                            <strong>{Number(override.letterSpacing).toFixed(3)}em</strong>
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="-0.2"
                                                            max="0.2"
                                                            step="0.005"
                                                            value={override.letterSpacing}
                                                            onChange={(event) => updateTextOverride(item, { letterSpacing: Number(event.target.value) || 0 })}
                                                        />
                                                    </label>

                                                    <label className="field-control">
                                                        <span>Color Source</span>
                                                        <select
                                                            value={override.colorToken}
                                                            onChange={(event) => updateTextOverride(item, { colorToken: event.target.value })}
                                                        >
                                                            {TEXT_COLOR_OPTIONS.map((option) => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>

                                                    {override.colorToken === 'custom' && (
                                                        <label className="color-control">
                                                            <span>Custom Color</span>
                                                            <div className="color-input-wrap">
                                                                <input
                                                                    type="color"
                                                                    value={override.customColor}
                                                                    onChange={(event) => updateTextOverride(item, { customColor: event.target.value })}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={override.customColor}
                                                                    onChange={(event) => {
                                                                        const value = cleanHex(event.target.value);
                                                                        if (!value) return;
                                                                        updateTextOverride(item, { customColor: value });
                                                                    }}
                                                                />
                                                            </div>
                                                        </label>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>

                                <aside className="scan-stage">
                                    <p className="preview-caption">Visual Section Preview</p>
                                    <p className="panel-hint">{scanPreviewMessage}</p>
                                    {activeScanPreviewItem ? (
                                        <iframe
                                            key={`${activeScanPreviewItem.id}:${activeScanPreviewItem.previewRoute || activeScanPreviewItem.route || '/'}`}
                                            ref={scanFrameRef}
                                            title={`Preview ${activeScanPreviewItem.selector}`}
                                            src={activeScanPreviewItem.previewRoute || activeScanPreviewItem.route || '/'}
                                            className="scan-frame"
                                            onLoad={(event) => highlightScanPreviewInFrame(event.currentTarget, activeScanPreviewItem)}
                                        />
                                    ) : (
                                        <div className="scan-frame-empty">Select a scanned text block to preview its live section.</div>
                                    )}
                                </aside>
                                </div>
                            </>
                        )}
                    </section>
                )}

                {activeTab === 'defaults' && (
                    <section className="panel defaults-section defaults-section-brand">
                        <div className="panel-head">
                            <div>
                                <h3>Brand Palette Defaults</h3>
                                <p className="panel-hint">
                                    Set your base colors once. Dark/Light micro controls below map key surfaces strictly to brand tokens.
                                </p>
                            </div>
                        </div>
                        <div className="control-grid color-grid defaults-grid">
                            {BRAND_COLORS.map((control) => (
                                <label key={control.key} className="color-control">
                                    <span>{control.label}</span>
                                    <div className="color-input-wrap">
                                        <input
                                            type="color"
                                            value={settings.colors[control.key]}
                                            onChange={(event) => updateBrandColor(control.key, event.target.value)}
                                        />
                                        <input
                                            type="text"
                                            value={settings.colors[control.key]}
                                            onChange={(event) => updateBrandColor(control.key, event.target.value)}
                                            pattern="^#[0-9A-Fa-f]{6}$"
                                        />
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="feature-typography-section mode-mapping-panel">
                            <p className="preview-caption">{activeMode === 'dark' ? 'Dark Mode' : 'Light Mode'} Micro Mapping</p>
                            <div className="control-grid">
                                {BRAND_MODE_MICRO_FIELDS.map((field) => {
                                    const currentHex = settings.modeColors[activeMode][field.key];
                                    return (
                                        <label key={`${activeMode}-${field.key}`} className="field-control">
                                            <span>{field.label}</span>
                                            <select
                                                value={matchBrandTokenByHex(settings, currentHex)}
                                                onChange={(event) => setModeColorFromBrandToken(activeMode, field.key, event.target.value)}
                                            >
                                                {BRAND_TOKEN_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="token-chip-row">
                                                <span className="token-chip-dot" style={{ background: currentHex }} />
                                                <code>{currentHex}</code>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'defaults' && (
                    <section className="panel defaults-section defaults-section-mode">
                        <div className="panel-head">
                            <div>
                                <h3>Dark / Light Defaults</h3>
                                <p className="panel-hint">Mode is controlled from the sticky top bar.</p>
                            </div>
                        </div>

                        <div className="mode-defaults-layout">
                            <div className="mode-preview" style={{ background: modePreview.pageBackground, color: modePreview.textPrimary, borderColor: modePreview.borderSubtle }}>
                                <div className="mode-preview-header" style={{ background: modePreview.headerBackground, color: modePreview.headerText, borderColor: modePreview.headerBorder }}>
                                    Header Preview
                                </div>
                                <div className="mode-preview-body">
                                    <h4 style={{ color: modePreview.textPrimary, fontFamily: fontMap[settings.fonts.h3] }}>Mode Preview</h4>
                                    <p style={{ color: modePreview.textSecondary, fontFamily: fontMap[settings.fonts.paragraph] }}>
                                        Fine-tune page background, header, footer, borders, and text colors for this mode.
                                    </p>
                                    <a href="#" onClick={(event) => event.preventDefault()} style={{ color: modePreview.link }}>
                                        Link color preview
                                    </a>
                                    <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                                        <span
                                            style={{
                                                background: modePreview.selection,
                                                borderRadius: '4px',
                                                padding: '0.1rem 0.35rem',
                                                color: '#000',
                                                fontFamily: fontMap[settings.fonts.ui],
                                                fontSize: '0.68rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Selection
                                        </span>
                                    </p>
                                </div>
                                <div className="mode-preview-footer" style={{ background: modePreview.footerBackground, color: modePreview.footerText, borderColor: modePreview.footerBorder }}>
                                    Footer Preview
                                </div>
                            </div>

                            <div className="control-grid color-grid dense mode-color-grid">
                                {MODE_COLOR_FIELDS.map((field) => (
                                    <label key={field.key} className="color-control">
                                        <span>{field.label}</span>
                                        <div className="color-input-wrap">
                                            <input
                                                type="color"
                                                value={settings.modeColors[activeMode][field.key]}
                                                onChange={(event) => updateModeColor(activeMode, field.key, event.target.value)}
                                            />
                                            <input
                                                type="text"
                                                value={settings.modeColors[activeMode][field.key]}
                                                onChange={(event) => updateModeColor(activeMode, field.key, event.target.value)}
                                                pattern="^#[0-9A-Fa-f]{6}$"
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'defaults' && (
                    <section className="panel defaults-section">
                        <h3>Links + Buttons Defaults</h3>
                        <p className="panel-hint">
                            Link controls are global. Button style applies only to elements using <code>.btn</code>, <code>.btn-primary</code>, or <code>.btn-secondary</code>.
                        </p>

                        <div className="inline-controls">
                            <label className="check-control">
                                <input
                                    type="checkbox"
                                    checked={settings.links.underline}
                                    onChange={(event) => updateLinkSettings('underline', event.target.checked)}
                                />
                                <span>Underline links globally</span>
                            </label>

                            <label className="check-control">
                                <input
                                    type="checkbox"
                                    checked={settings.links.hoverUnderline}
                                    onChange={(event) => updateLinkSettings('hoverUnderline', event.target.checked)}
                                />
                                <span>Underline links on hover</span>
                            </label>

                            <label className="check-control">
                                <input
                                    type="checkbox"
                                    checked={settings.links.hoverColorEnabled}
                                    onChange={(event) => updateLinkSettings('hoverColorEnabled', event.target.checked)}
                                />
                                <span>Force global link hover color</span>
                            </label>
                        </div>

                        <p className="field-help">
                            Off: each mode uses its own Link Hover color from Dark/Light Defaults. On: both modes use the token selected below.
                        </p>

                        <label className="field-control" style={{ maxWidth: '360px' }}>
                            <span>Forced Hover Color Token</span>
                            <select
                                value={settings.links.hoverColorToken}
                                disabled={!settings.links.hoverColorEnabled}
                                onChange={(event) => updateLinkSettings('hoverColorToken', event.target.value)}
                            >
                                {BRAND_TOKEN_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <div className="token-chip-row">
                                <span className="token-chip-dot" style={{ background: resolveBrandTokenHex(settings, settings.links.hoverColorToken) }} />
                                <code>{resolveBrandTokenHex(settings, settings.links.hoverColorToken)}</code>
                            </div>
                        </label>

                        <label className="slider-control radius-slider">
                            <span className="control-label">
                                Global Border Radius
                                <strong>{Math.round(settings.radius.base)}px</strong>
                            </span>
                            <input type="range" min="0" max="32" step="1" value={settings.radius.base} onChange={(event) => updateRadius(event.target.value)} />
                        </label>

                        <div className="button-style-grid">
                            {BUTTON_STYLE_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`button-style-card ${settings.buttons.style === option.id ? 'active' : ''}`}
                                    onClick={() => setButtonStyle(option.id)}
                                >
                                    <span className="button-style-title">{option.label}</span>
                                    <span className="button-style-desc">{option.description}</span>
                                </button>
                            ))}
                        </div>

                        <div className="button-style-preview">
                            <button type="button" className="btn-secondary">Secondary</button>
                            <button type="button" className="btn">Default</button>
                            <button type="button" className="btn-primary">Primary</button>
                        </div>
                    </section>
                )}

                {activeTab === 'defaults' && (
                    <section className="panel defaults-section presets-panel">
                        <h3>Saved Default States</h3>
                        <p className="panel-hint">Name a style state, save it, and apply it later with one click.</p>

                        <div className="preset-create">
                            <input
                                type="text"
                                value={presetName}
                                onChange={(event) => setPresetName(event.target.value)}
                                placeholder="Preset name (e.g., Creative Lab Light)"
                            />
                            <button type="button" className="btn-primary-action" onClick={handleCreatePreset} disabled={busyPresetId === 'new'}>
                                {busyPresetId === 'new' ? 'Saving...' : 'Save Preset'}
                            </button>
                        </div>

                        {loadingPresets ? (
                            <p className="panel-hint">Loading presets...</p>
                        ) : presets.length === 0 ? (
                            <p className="panel-hint">No presets saved yet.</p>
                        ) : (
                            <div className="preset-list">
                                {presets.map((preset) => (
                                    <article key={preset.id} className="preset-card">
                                        <div className="preset-copy">
                                            <h4>{preset.name}</h4>
                                            <p>Updated {formatDate(preset.updated_at || preset.created_at)}</p>
                                        </div>

                                        <div className="preset-actions">
                                            <button
                                                type="button"
                                                className="btn-primary-action"
                                                onClick={() => handleApplyPreset(preset)}
                                                disabled={busyPresetId === preset.id}
                                            >
                                                {busyPresetId === preset.id ? 'Applying...' : 'Apply'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary-action"
                                                onClick={() => handleOverwritePreset(preset)}
                                                disabled={busyPresetId === preset.id}
                                            >
                                                Overwrite
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary-action danger"
                                                onClick={() => handleDeletePreset(preset)}
                                                disabled={busyPresetId === preset.id}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>

            <style>{`
                .design-manager {
                    display: flex;
                    flex-direction: column;
                    gap: 0.9rem;
                    color: var(--text-primary);
                    max-height: calc(100dvh - 170px);
                    min-height: 0;
                }

                .studio-sticky-shell {
                    position: sticky;
                    top: 0.6rem;
                    z-index: 20;
                    display: grid;
                    gap: 0.7rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
                    backdrop-filter: blur(10px);
                    padding: 0.85rem;
                }

                .design-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    border-bottom: 1px solid var(--border-subtle);
                    padding-bottom: 0.75rem;
                }

                .design-header-copy h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 600;
                }

                .design-header-copy p {
                    margin: 0.35rem 0 0;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    max-width: 620px;
                    line-height: 1.45;
                }

                .design-header-actions {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.55rem;
                    justify-content: flex-end;
                }

                .mode-sticky-switch {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.3rem 0.45rem;
                }

                .mode-sticky-label {
                    font-size: 0.63rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--text-secondary);
                    white-space: nowrap;
                }

                .sub-pills {
                    display: inline-flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                }

                .autosave-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-surface);
                    padding: 0.48rem 0.65rem;
                    font-size: 0.78rem;
                    color: var(--text-secondary);
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .autosave-toggle input {
                    accent-color: var(--accent-primary);
                }

                .btn-primary-action,
                .btn-secondary-action {
                    border-radius: var(--radius-base, 10px);
                    border: 1px solid var(--border-subtle);
                    padding: 0.5rem 0.75rem;
                    font-size: 0.75rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    cursor: pointer;
                    transition: transform 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
                }

                .btn-primary-action {
                    background: var(--accent-primary);
                    color: var(--text-inverse);
                    border-color: var(--accent-primary);
                }

                .btn-secondary-action {
                    background: var(--bg-surface);
                    color: var(--text-primary);
                }

                .btn-secondary-action.danger {
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.45);
                }

                .btn-primary-action:hover,
                .btn-secondary-action:hover {
                    transform: translateY(-1px);
                }

                .btn-primary-action:disabled,
                .btn-secondary-action:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .status-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                }

                .status-bar .dirty {
                    color: #f59e0b;
                }

                .status-bar .clean {
                    color: #10b981;
                }

                .alert {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    padding: 0.6rem 0.75rem;
                    font-size: 0.83rem;
                }

                .alert.error {
                    border-color: #ef4444;
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.08);
                }

                .alert.success {
                    border-color: #10b981;
                    color: #10b981;
                    background: rgba(16, 185, 129, 0.08);
                }

                .pill-nav {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.45rem;
                }

                .pill {
                    border: 1px solid var(--border-subtle);
                    border-radius: 999px;
                    background: var(--bg-surface);
                    color: var(--text-secondary);
                    padding: 0.45rem 0.75rem;
                    font-size: 0.75rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    cursor: pointer;
                }

                .pill.active {
                    color: var(--text-inverse);
                    background: var(--accent-primary);
                    border-color: var(--accent-primary);
                }

                .pill.mini {
                    font-size: 0.68rem;
                    padding: 0.4rem 0.65rem;
                }

                .tab-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-surface);
                    padding: 1rem;
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                }

                .panel {
                    display: flex;
                    flex-direction: column;
                    gap: 0.9rem;
                }

                .defaults-section {
                    gap: 1rem;
                }

                .tab-panel > .defaults-section + .defaults-section {
                    margin-top: 1.25rem;
                    padding-top: 1.15rem;
                    border-top: 1px solid var(--border-subtle);
                }

                .panel h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .panel-hint {
                    margin: 0;
                    font-size: 0.82rem;
                    color: var(--text-secondary);
                }

                .panel-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.7rem;
                }

                .unit-toggle {
                    display: inline-flex;
                    gap: 0.25rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 999px;
                    padding: 0.2rem;
                    background: var(--bg-canvas);
                }

                .unit-toggle button {
                    border: none;
                    border-radius: 999px;
                    background: transparent;
                    color: var(--text-secondary);
                    padding: 0.33rem 0.65rem;
                    font-size: 0.7rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    cursor: pointer;
                }

                .unit-toggle button.active {
                    background: var(--accent-primary);
                    color: var(--text-inverse);
                }

                .control-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 0.75rem;
                }

                .defaults-grid {
                    gap: 0.9rem;
                }

                .slider-control,
                .field-control,
                .color-control {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.7rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.45rem;
                }

                .control-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 0.7rem;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                }

                .control-label strong {
                    color: var(--text-primary);
                }

                .field-control span,
                .color-control span {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .field-help {
                    margin: -0.1rem 0 0;
                    font-size: 0.76rem;
                    color: var(--text-tertiary);
                    max-width: 740px;
                    line-height: 1.45;
                }

                .field-control select,
                .field-control input,
                .color-input-wrap input[type="text"],
                .preset-create input {
                    width: 100%;
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 4px);
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    padding: 0.5rem 0.6rem;
                    font-size: 0.82rem;
                    font-family: var(--font-ui);
                }

                .color-grid {
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                }

                .color-grid.dense {
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                }

                .preview-caption {
                    margin: 0 0 0.35rem;
                    color: var(--text-secondary);
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    font-family: var(--font-ui);
                }

                .type-studio-grid {
                    display: grid;
                    grid-template-columns: minmax(180px, 240px) 1fr;
                    gap: 0.75rem;
                    align-items: start;
                }

                .type-token-list {
                    display: grid;
                    gap: 0.45rem;
                }

                .type-token-btn {
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    background: var(--bg-canvas);
                    color: var(--text-primary);
                    padding: 0.58rem 0.62rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 0.45rem;
                    text-align: left;
                    cursor: pointer;
                    font-family: var(--font-ui);
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .type-token-btn strong {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                }

                .type-token-btn.active {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 1px var(--accent-primary) inset;
                    background: var(--bg-surface);
                }

                .type-inspector {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 0.6rem;
                    align-items: start;
                }

                .type-color-block {
                    grid-column: 1 / -1;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.7rem;
                    display: grid;
                    gap: 0.55rem;
                }

                .type-color-title {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .type-color-swatches {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 0.4rem;
                }

                .type-color-swatch-btn {
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 3px);
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    min-height: 40px;
                    padding: 0.4rem 0.45rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 0.35rem;
                    font-size: 0.7rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    cursor: pointer;
                    text-align: left;
                }

                .type-color-swatch-btn.active {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 1px var(--accent-primary) inset;
                }

                .type-color-dot {
                    width: 14px;
                    height: 14px;
                    border-radius: 999px;
                    border: 1px solid rgba(0, 0, 0, 0.24);
                    flex: 0 0 14px;
                }

                .type-color-custom {
                    margin-top: 0.1rem;
                }

                .type-preview-stage {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.8rem;
                    display: grid;
                    gap: 0.4rem;
                }

                .type-preview-sample {
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    background: var(--bg-surface);
                    padding: clamp(0.9rem, 2vw, 1.2rem);
                    overflow-wrap: anywhere;
                }

                .type-reference-list {
                    display: grid;
                    gap: 0.55rem;
                }

                .affected-item {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-surface);
                    padding: 0.65rem;
                }

                .affected-kicker {
                    display: inline-block;
                    margin-bottom: 0.35rem;
                    font-family: var(--font-ui);
                    font-size: 0.64rem;
                    color: var(--text-secondary);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .type-reference-sample {
                    overflow-wrap: anywhere;
                }

                .feature-typography-section {
                    display: grid;
                    gap: 0.65rem;
                }

                .mode-mapping-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.85rem;
                    gap: 0.75rem;
                }

                .mode-mapping-panel .preview-caption {
                    margin: 0 0 0.2rem;
                }

                .mode-defaults-layout {
                    display: grid;
                    gap: 0.95rem;
                }

                .mode-color-grid {
                    gap: 0.9rem;
                }

                .feature-override-studio {
                    display: grid;
                    grid-template-columns: minmax(230px, 320px) minmax(0, 1fr);
                    gap: 0.75rem;
                    align-items: start;
                }

                .feature-override-list {
                    display: grid;
                    gap: 0.45rem;
                    max-height: 68vh;
                    overflow: auto;
                    padding-right: 0.2rem;
                }

                .feature-override-item {
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    background: var(--bg-canvas);
                    color: var(--text-primary);
                    padding: 0.6rem 0.62rem;
                    display: grid;
                    gap: 0.2rem;
                    text-align: left;
                    cursor: pointer;
                }

                .feature-override-item.active {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 1px var(--accent-primary) inset;
                    background: var(--bg-surface);
                }

                .feature-override-item-label {
                    font-size: 0.76rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .feature-override-item-target {
                    font-size: 0.68rem;
                    color: var(--text-secondary);
                    font-family: var(--font-ui);
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .feature-override-inspector {
                    display: grid;
                    gap: 0.65rem;
                }

                .feature-type-head {
                    display: grid;
                    gap: 0.18rem;
                }

                .feature-type-head strong {
                    font-size: 0.84rem;
                    color: var(--text-primary);
                }

                .feature-type-head span {
                    font-family: var(--font-ui);
                    font-size: 0.67rem;
                    color: var(--text-secondary);
                    letter-spacing: 0.04em;
                }

                .mini-unit-toggle {
                    display: inline-flex;
                    gap: 0.25rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 999px;
                    padding: 0.2rem;
                    background: var(--bg-surface);
                    width: fit-content;
                }

                .mini-unit-toggle button {
                    border: none;
                    border-radius: 999px;
                    background: transparent;
                    color: var(--text-secondary);
                    padding: 0.28rem 0.55rem;
                    font-size: 0.65rem;
                    font-family: var(--font-ui);
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    cursor: pointer;
                }

                .mini-unit-toggle button.active {
                    background: var(--accent-primary);
                    color: var(--text-inverse);
                }

                .feature-type-preview {
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    background: var(--bg-surface);
                    padding: 0.8rem;
                    overflow-wrap: anywhere;
                }

                .scan-filters {
                    display: grid;
                    gap: 0.65rem;
                }

                .scan-pills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }

                .scan-route-select {
                    max-width: 340px;
                }

                .scan-workbench {
                    display: grid;
                    grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
                    gap: 0.8rem;
                    align-items: start;
                }

                .scan-stage {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.75rem;
                    display: grid;
                    gap: 0.45rem;
                    position: sticky;
                    top: 0.5rem;
                }

                .scan-frame {
                    width: 100%;
                    height: 680px;
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    background: #ffffff;
                }

                .scan-frame-empty {
                    min-height: 220px;
                    border: 1px dashed var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 2px);
                    display: grid;
                    place-items: center;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    text-align: center;
                    padding: 0.8rem;
                }

                .scan-list {
                    display: grid;
                    gap: 0.75rem;
                    max-height: 74vh;
                    overflow: auto;
                    padding-right: 0.2rem;
                    align-content: start;
                }

                .scan-card {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.75rem;
                    display: grid;
                    gap: 0.65rem;
                }

                .scan-card.is-previewing {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 1px var(--accent-primary) inset;
                }

                .scan-card-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 0.7rem;
                    align-items: flex-start;
                    flex-wrap: wrap;
                }

                .scan-card-actions {
                    display: inline-flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.4rem;
                }

                .scan-card-actions .btn-secondary-action {
                    padding: 0.38rem 0.6rem;
                    font-size: 0.68rem;
                }

                .scan-meta {
                    display: grid;
                    gap: 0.2rem;
                }

                .scan-meta strong {
                    font-size: 0.86rem;
                    color: var(--text-primary);
                }

                .scan-meta span {
                    font-size: 0.72rem;
                    color: var(--text-secondary);
                    font-family: var(--font-ui);
                }

                .scan-mini-type {
                    margin-top: 0.15rem;
                    display: inline-flex;
                    align-items: baseline;
                    gap: 0.4rem;
                }

                .scan-mini-aa {
                    font-size: 0.85rem;
                    font-weight: 600;
                    line-height: 1;
                }

                .scan-mini-font {
                    font-size: 0.62rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-secondary);
                }

                .scan-link {
                    font-size: 0.72rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--link-color);
                    text-decoration: none;
                }

                .scan-link.muted {
                    color: var(--text-tertiary);
                }

                .scan-controls {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.55rem;
                    align-items: end;
                }

                .color-input-wrap {
                    display: grid;
                    grid-template-columns: 44px 1fr;
                    gap: 0.5rem;
                    align-items: center;
                }

                .color-input-wrap input[type="color"] {
                    width: 44px;
                    height: 34px;
                    border: 1px solid var(--border-subtle);
                    border-radius: calc(var(--radius-base, 10px) - 4px);
                    background: transparent;
                    padding: 0;
                    cursor: pointer;
                }

                .token-chip-row {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    padding: 0.25rem 0;
                }

                .token-chip-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 999px;
                    border: 1px solid var(--border-subtle);
                    flex: 0 0 12px;
                }

                .token-chip-row code {
                    font-size: 0.72rem;
                    color: var(--text-secondary);
                    font-family: var(--font-ui);
                }

                .mode-preview {
                    border: 1px solid;
                    border-radius: var(--radius-base, 10px);
                    overflow: hidden;
                }

                .mode-preview-header,
                .mode-preview-footer {
                    padding: 0.65rem 0.8rem;
                    border-bottom: 1px solid;
                    font-size: 0.74rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .mode-preview-footer {
                    border-top: 1px solid;
                    border-bottom: none;
                }

                .mode-preview-body {
                    padding: 0.9rem;
                }

                .mode-preview-body h4 {
                    margin: 0 0 0.35rem;
                    font-size: 1.05rem;
                }

                .mode-preview-body p {
                    margin: 0 0 0.45rem;
                    font-size: 0.9rem;
                    line-height: 1.5;
                }

                .mode-preview-body a {
                    font-size: 0.85rem;
                }

                .inline-controls {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.9rem;
                }

                .check-control {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    color: var(--text-secondary);
                    font-size: 0.82rem;
                }

                .check-control input {
                    accent-color: var(--accent-primary);
                }

                .radius-slider {
                    max-width: 460px;
                }

                input[type="range"] {
                    width: 100%;
                    accent-color: var(--accent-primary);
                }

                .button-style-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 0.7rem;
                }

                .button-style-preview {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.6rem;
                    padding-top: 0.15rem;
                }

                .button-style-card {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    color: var(--text-primary);
                    padding: 0.75rem;
                    text-align: left;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                }

                .button-style-card.active {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 1px var(--accent-primary) inset;
                }

                .button-style-title {
                    font-size: 0.8rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .button-style-desc {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .presets-panel {
                    gap: 0.75rem;
                }

                .preset-create {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 0.55rem;
                    align-items: center;
                }

                .preset-list {
                    display: grid;
                    gap: 0.65rem;
                }

                .preset-card {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-base, 10px);
                    background: var(--bg-canvas);
                    padding: 0.7rem;
                    display: flex;
                    justify-content: space-between;
                    gap: 0.75rem;
                    align-items: center;
                }

                .preset-copy h4 {
                    margin: 0;
                    font-size: 0.92rem;
                }

                .preset-copy p {
                    margin: 0.25rem 0 0;
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                }

                .preset-actions {
                    display: flex;
                    gap: 0.45rem;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                @media (max-width: 1080px) {
                    .design-manager {
                        max-height: calc(100dvh - 120px);
                    }

                    .studio-sticky-shell {
                        top: 0.35rem;
                    }

                    .design-header {
                        flex-direction: column;
                    }

                    .design-header-actions {
                        justify-content: flex-start;
                        width: 100%;
                    }

                    .preset-card {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .preset-actions {
                        width: 100%;
                        justify-content: flex-start;
                    }

                    .type-studio-grid {
                        grid-template-columns: 1fr;
                    }

                    .type-inspector {
                        grid-template-columns: 1fr;
                    }

                    .type-color-swatches {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .scan-workbench {
                        grid-template-columns: 1fr;
                    }

                    .scan-stage {
                        position: static;
                    }

                    .feature-override-studio {
                        grid-template-columns: 1fr;
                    }

                    .feature-override-list {
                        max-height: none;
                    }

                    .panel-head {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
}
