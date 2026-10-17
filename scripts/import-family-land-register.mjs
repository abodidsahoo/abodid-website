import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { encryptLandAsset } from '../src/lib/land/crypto.mjs';

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

const sourceRoot = getArg('--source');
const personIndexPath = getArg('--person-index');
const encryptionKey = process.env.LAND_DATA_ENCRYPTION_KEY;

if (!sourceRoot) throw new Error('Usage: node scripts/import-family-land-register.mjs --source <folder> [--person-index <json>]');
if (!encryptionKey) throw new Error('LAND_DATA_ENCRYPTION_KEY is required.');

const source = resolve(sourceRoot);
const destination = resolve(process.cwd(), 'src/data/land/secure');
const reportPath = resolve(process.cwd(), 'src/data/land/import-report.json');
const khatas = JSON.parse(await readFile(join(source, 'data/khatas.json'), 'utf8'));

const plotCount = khatas.reduce((total, khata) => total + khata.plots.length, 0);
const totalAcres = khatas.reduce(
  (total, khata) => total + khata.plots.reduce((sum, plot) => sum + Number(plot.area_acres), 0),
  0,
);
const khataKeys = new Set();
const plotKeys = new Set();
const duplicateKhatas = [];
const duplicatePlots = [];

for (const khata of khatas) {
  const khataKey = [khata.district_od, khata.tehsil_od, khata.mouza_od, String(khata.khata_no)].join('|');
  if (khataKeys.has(khataKey)) duplicateKhatas.push(khataKey);
  khataKeys.add(khataKey);
  for (const plot of khata.plots) {
    const plotKey = `${khataKey}|${String(plot.plot_no)}`;
    if (plotKeys.has(plotKey)) duplicatePlots.push(plotKey);
    plotKeys.add(plotKey);
  }
}

if (khatas.length !== 11 || plotCount !== 28 || Math.abs(totalAcres - 6.1649) > 1e-9) {
  throw new Error(`Dataset control totals failed: ${khatas.length} khatas, ${plotCount} plots, ${totalAcres.toFixed(4)} acres.`);
}
if (duplicateKhatas.length || duplicatePlots.length) {
  throw new Error('Duplicate composite business keys were found.');
}

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');
const slugFor = (value) => String(value).replaceAll('/', '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
const pdfFiles = await readdir(join(source, 'source_pdfs'));
const markdownFiles = await readdir(join(source, 'khatas'));

await rm(destination, { recursive: true, force: true });
await mkdir(join(destination, 'pdfs'), { recursive: true });
await mkdir(join(destination, 'markdown'), { recursive: true });

const documents = [];
for (const khata of khatas) {
  const slug = slugFor(khata.khata_no);
  if (!pdfFiles.includes(khata.source_pdf)) throw new Error(`Missing PDF for khata ${khata.khata_no}.`);
  const pdf = await readFile(join(source, 'source_pdfs', khata.source_pdf));
  const markdownName = `Khata-${String(khata.khata_no).replaceAll('/', '-')}.md`;
  if (!markdownFiles.includes(markdownName)) throw new Error(`Missing Markdown for khata ${khata.khata_no}.`);
  const markdown = await readFile(join(source, 'khatas', markdownName));

  await writeFile(join(destination, 'pdfs', `${slug}.pdf.enc`), encryptLandAsset(pdf, encryptionKey));
  await writeFile(join(destination, 'markdown', `${slug}.md.enc`), encryptLandAsset(markdown, encryptionKey));
  documents.push({
    khata_no: String(khata.khata_no),
    slug,
    source_pdf: basename(khata.source_pdf),
    source_markdown: markdownName,
    pdf_sha256: sha256(pdf),
    markdown_sha256: sha256(markdown),
    pages: khata.pdf_pages,
  });
}

const personIndex = personIndexPath
  ? JSON.parse(await readFile(resolve(personIndexPath), 'utf8'))
  : { people: [], review_queue: [{ id: 'person-index-missing', reason: 'A reviewed private person index has not been supplied.' }] };

await writeFile(join(destination, 'khatas.json.enc'), encryptLandAsset(Buffer.from(JSON.stringify(khatas)), encryptionKey));
await writeFile(join(destination, 'documents.json.enc'), encryptLandAsset(Buffer.from(JSON.stringify(documents)), encryptionKey));
await writeFile(join(destination, 'people.json.enc'), encryptLandAsset(Buffer.from(JSON.stringify(personIndex)), encryptionKey));

const report = {
  generated_at: new Date().toISOString(),
  source_type: 'encrypted server-only import',
  khatas: khatas.length,
  plots: plotCount,
  total_listed_acres: Number(totalAcres.toFixed(4)),
  duplicate_khata_keys: duplicateKhatas.length,
  duplicate_plot_keys: duplicatePlots.length,
  source_documents: documents.length,
  known_discrepancy_checks: {
    khata_97: khatas.find((item) => item.khata_no === '97')?.plot_count === 3,
    khata_147_564: Boolean(khatas.find((item) => item.khata_no === '147/564')),
    khata_474_7010: Boolean(khatas.find((item) => item.khata_no === '474/7010')?.issues?.length),
    khata_67: khatas.find((item) => item.khata_no === '67')?.plot_count === 12,
  },
};
await mkdir(resolve(process.cwd(), 'src/data/land'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

