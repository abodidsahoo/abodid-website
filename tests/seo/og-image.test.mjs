import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    cleanTitleText,
    detectCategory,
    resolveTheme,
    cleanSubtitleText,
    getTitleFontSize,
    POP_THEMES,
} from '../../src/lib/og-theme.js';

test('og-helper: cleanTitleText strips redundant branding and author noise', () => {
    assert.equal(cleanTitleText('Curated Opportunities • Abodid Sahoo'), 'Curated Opportunities');
    assert.equal(cleanTitleText('Curated Opportunities | Abodid Sahoo'), 'Curated Opportunities');
    assert.equal(cleanTitleText('Photography Studio — Abodid Sahoo'), 'Photography Studio');
    assert.equal(cleanTitleText('Punctum AI - Abodid Sahoo'), 'Punctum AI');
    assert.equal(cleanTitleText('Abodid Sahoo'), 'Abodid Sahoo');
    assert.equal(cleanTitleText(''), 'Abodid Sahoo');
});

test('og-helper: detectCategory correctly maps archetypes', () => {
    assert.equal(detectCategory('Curated Opportunities'), 'OPPORTUNITIES');
    assert.equal(detectCategory('Artist Grants & Residency Radar'), 'OPPORTUNITIES');
    assert.equal(detectCategory('Photography Studio Portfolio'), 'PHOTOGRAPHY');
    assert.equal(detectCategory('Short Film & Video Supercut'), 'CINEMA & FILM');
    assert.equal(detectCategory('Punctum AI Lab Experiment'), 'LAB & RESEARCH');
    assert.equal(detectCategory('Obsidian Second Brain Notes'), 'OBSIDIAN VAULT');
    assert.equal(detectCategory('Video Editing Workshop Masterclass'), 'WORKSHOPS');
    assert.equal(detectCategory('Website Architecture Overview'), 'ARCHITECTURE');
    assert.equal(detectCategory('Reflections on Generative Aesthetics'), 'ESSAYS & JOURNAL');
    assert.equal(detectCategory('Custom Title', 'CUSTOM_TAG'), 'CUSTOM_TAG');
});

test('og-helper: resolveTheme enforces high contrast pairing rules', () => {
    // Yellow must have dark ink text
    assert.equal(POP_THEMES.yellow.bg, '#ffe44f');
    assert.equal(POP_THEMES.yellow.text, '#15130f');

    // Blue & Purple must have white text
    assert.equal(POP_THEMES.blue.bg, '#2444ca');
    assert.equal(POP_THEMES.blue.text, '#ffffff');

    assert.equal(POP_THEMES.purple.bg, '#5524c7');
    assert.equal(POP_THEMES.purple.text, '#ffffff');

    // Lime & Cream must have ink text
    assert.equal(POP_THEMES.lime.text, '#15130f');
    assert.equal(POP_THEMES.cream.text, '#15130f');

    // Dark must have white text
    assert.equal(POP_THEMES.dark.bg, '#15130f');
    assert.equal(POP_THEMES.dark.text, '#ffffff');

    const oppTheme = resolveTheme('Opportunities', 'OPPORTUNITIES');
    assert.equal(oppTheme.name, 'yellow');

    const cinemaTheme = resolveTheme('Short Films', 'CINEMA & FILM');
    assert.equal(cinemaTheme.name, 'purple');

    const labTheme = resolveTheme('Punctum AI', 'LAB & RESEARCH');
    assert.equal(labTheme.name, 'lime');

    const archTheme = resolveTheme('Website Architecture', 'ARCHITECTURE');
    assert.equal(archTheme.name, 'blue');
});

test('og-helper: cleanSubtitleText cleans long descriptions and avoids repeating title', () => {
    assert.equal(cleanSubtitleText('Curated Opportunities', 'Curated Opportunities'), undefined);

    const longDesc =
        'This is a very long description that goes on and on and explains way too much detail about the page that would overwhelm the social share card layout and look messy in chat apps like WhatsApp.';
    const cleaned = cleanSubtitleText(longDesc, 'Short Title');
    assert.ok(cleaned);
    assert.ok(cleaned.length <= 140);
    assert.ok(cleaned.endsWith('...'));
});

test('og-helper: getTitleFontSize scales down for longer titles to keep 1-2 lines', () => {
    const shortTitle = getTitleFontSize('Short Title'.length);
    const medTitle = getTitleFontSize('Curated Opportunities Radar'.length);
    const longTitle = getTitleFontSize('Turning an Abandoned Garage into London Art Exhibition Spot'.length);

    assert.ok(shortTitle.fontSize >= 70);
    assert.ok(medTitle.fontSize >= 60 && medTitle.fontSize < 75);
    assert.ok(longTitle.fontSize <= 55);
});
