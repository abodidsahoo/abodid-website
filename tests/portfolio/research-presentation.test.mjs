import test from 'node:test';
import assert from 'node:assert/strict';
import { researchPresentation } from '../../src/lib/researchPresentation.js';

const heading = (text) => ({ blockType: 'heading', content: { text } });
const text = (text) => ({ blockType: 'highlight', content: { text } });

test('authored outcomes appear once and keep the surrounding research narrative', () => {
  const introduction = { blockType: 'body_text', content: { text: 'The inquiry.' } };
  const gallery = { blockType: 'single_image', content: { media: { url: '/poster.jpg' } } };
  const result = researchPresentation([introduction, heading('Outcome'), text('**Accepted poster**\n\nPresented at the conference.'), gallery]);
  assert.deepEqual(result.blocks, [introduction, gallery]);
  assert.equal(result.outcomeText, 'Presented at the conference.');
  assert.equal(result.outcomeStatus, 'Accepted poster');
});

test('missing outcomes do not invent a research result or consume neighbouring content', () => {
  const blocks = [heading('Outcome'), heading('Methods'), { blockType: 'body_text', content: { text: 'Real methods.' } }];
  assert.deepEqual(researchPresentation(blocks), { blocks, outcomeText: '', outcomeStatus: null });
  assert.deepEqual(researchPresentation(null), { blocks: [], outcomeText: '', outcomeStatus: null });
  const image = { blockType: 'single_image', content: { media: { url: '/poster.jpg' } } };
  assert.equal(researchPresentation([heading('Status'), image]).blocks.length, 2);
});

test('hidden outcomes are never promoted to a public summary', () => {
  for (const blocks of [
    [{ ...heading('Outcome'), visible: false }, text('Private result')],
    [heading('Outcome'), { ...text('Private result'), visible: false }],
  ]) assert.equal(researchPresentation(blocks).outcomeText, '');
});
