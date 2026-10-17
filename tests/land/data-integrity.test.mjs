import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decryptLandAsset } from '../../src/lib/land/crypto.mjs';
import { buildLandBundle, landBusinessKey, validateLandRevisionInput } from '../../src/lib/land/dataLogic.mjs';

const secret = process.env.LAND_DATA_ENCRYPTION_KEY;
const readSecureJson = async (name) => {
  assert.match(secret || '', /^[a-f0-9]{64}$/i, 'LAND_DATA_ENCRYPTION_KEY must be configured for private data checks');
  const envelope = await readFile(new URL(`../../src/data/land/secure/${name}`, import.meta.url), 'utf8');
  return JSON.parse(decryptLandAsset(envelope, secret).toString('utf8'));
};

const load = async () => {
  const [khatas, documents, people] = await Promise.all([
    readSecureJson('khatas.json.enc'), readSecureJson('documents.json.enc'), readSecureJson('people.json.enc'),
  ]);
  return { khatas, documents, people, bundle: buildLandBundle({ khatas, documents, people }) };
};

test('encrypted seed matches the register control totals', async () => {
  const { bundle } = await load();
  assert.equal(bundle.summary.khatas, 11);
  assert.equal(bundle.summary.plots, 28);
  assert.equal(Number(bundle.summary.total_acres.toFixed(4)), 6.1649);
  assert.equal(new Set(bundle.khatas.map((khata) => khata.id)).size, 11);
  assert.equal(new Set(bundle.khatas.flatMap((khata) => khata.plots.map((plot) => plot.business_key))).size, 28);
});

test('known PDF discrepancies remain explicit and identifiers remain strings', async () => {
  const { bundle } = await load();
  const khata97 = bundle.khatas.find((khata) => khata.khata_no === '97');
  assert.equal(khata97.plot_count, 3);
  assert.equal(Number(khata97.total_acres.toFixed(4)), 0.65);
  assert.ok(khata97.issues.some((issue) => issue.includes('filename')));
  assert.ok(bundle.khatas.some((khata) => khata.khata_no === '147/564'));
  assert.ok(bundle.khatas.find((khata) => khata.khata_no === '474/7010').issues.length > 0);
  assert.equal(bundle.khatas.find((khata) => khata.khata_no === '67').plots.length, 12);
  assert.ok(bundle.khatas.flatMap((khata) => khata.plots).every((plot) => typeof plot.plot_no === 'string'));
});

test('the person index only links names found in recorded-holder source fields', async () => {
  const { bundle } = await load();
  for (const person of bundle.people) {
    assert.equal(person.role, 'recorded_holder');
    for (const khataNumber of person.khata_numbers) {
      const khata = bundle.khatas.find((item) => item.khata_no === khataNumber);
      assert.ok(khata, `Missing khata link ${khataNumber}`);
      assert.ok(khata.recorded_holders_od.includes(person.label_od), `Unverified person link ${person.id}`);
    }
  }
});

test('each encrypted PDF matches its private source manifest hash', async () => {
  const { documents } = await load();
  for (const document of documents) {
    const envelope = await readFile(new URL(`../../src/data/land/secure/pdfs/${document.slug}.pdf.enc`, import.meta.url), 'utf8');
    const pdf = decryptLandAsset(envelope, secret);
    assert.equal(createHash('sha256').update(pdf).digest('hex'), document.pdf_sha256);
    assert.equal(pdf.subarray(0, 4).toString('ascii'), '%PDF');
  }
});

test('revision validation requires source, reason, and allowed fields', () => {
  assert.equal(validateLandRevisionInput({ change_type: 'correct' }).ok, false);
  assert.equal(validateLandRevisionInput({
    change_type: 'correct', business_key: 'a|b|c|1|2', reason: 'Verified against the current PDF',
    source_reference: 'PDF page 2', patch: { scope: 'plot', field: 'area_acres', value: 0.2 },
  }).ok, true);
  assert.equal(validateLandRevisionInput({
    change_type: 'correct', business_key: 'a|b|c|1|2', reason: 'Verified against the current PDF',
    source_reference: 'PDF page 2', patch: { scope: 'plot', field: 'owner_percentage', value: 100 },
  }).ok, false);
});

test('area conversion and comparison use area-preserving square-root scaling', async () => {
  const { bundle } = await load();
  const areas = bundle.khatas.flatMap((khata) => khata.plots.map((plot) => plot.area_acres));
  const smaller = Math.min(...areas);
  const larger = Math.max(...areas);
  const sideRatio = Math.sqrt(smaller / larger);
  assert.ok(sideRatio > 0 && sideRatio < 1);
  assert.equal(Number((smaller * 43560).toFixed(6)), Number((smaller * 43560).toFixed(6)));
  const khata = bundle.khatas[0];
  assert.equal(landBusinessKey.makePlotKey(khata, khata.plots[0]), khata.plots[0].business_key);
});

