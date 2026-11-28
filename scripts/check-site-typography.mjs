import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

// Standard page families adopted into the shared scale. Art-directed lab and
// archived layouts are deliberately outside this contract.
const files = [
  'src/pages/index.astro',
  'src/pages/about.astro',
  'src/pages/services.astro',
  'src/pages/experience.astro',
  'src/pages/work/index.astro',
  'src/pages/blog/[...slug].astro',
  'src/components/LandingInteractiveHero.jsx',
  'src/components/LandingTestimonials.astro',
  'src/components/InlineInquiryForm.astro',
  'src/components/Newsletter.astro',
  'src/components/blog/BlogBlockRenderer.jsx',
  'src/styles/journal-header.css',
  'src/styles/editorial-footer.css',
  'src/styles/blog-editorial.css',
  'src/styles/reading-editorial.css',
  'src/styles/research-portfolio.css',
  'src/styles/research-papers.css',
  'src/styles/research-paper-detail.css',
  'src/styles/resources-editorial.css',
  'src/styles/portfolio-pop-editorial.css',
  'src/styles/archival-bootcamp.css',
  'src/styles/atlas-of-people-and-pictures.css',
];
const failures = [];
for (const file of files) {
  const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  const css = file.endsWith('.css') ? source
    : file.endsWith('.jsx') ? source.match(/<style>\{`([\s\S]*?)`\}<\/style>/)?.[1]
      : source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1];
  if (!css && !file.endsWith('.jsx')) throw new Error(`Typography coverage has no stylesheet: ${file}`);
  if (file.endsWith('.jsx')) {
    for (const match of source.matchAll(/\b(fontSize|fontWeight|font)\s*:\s*(['"])(.*?)\2/g)) {
      if (!/var\(--type-|^(inherit|1em)$/.test(match[3])) failures.push(`${file}: inline ${match[1]}: ${match[3]}`);
    }
    for (const match of source.matchAll(/\b(fontSize|fontWeight)\s*:\s*\d+/g)) failures.push(`${file}: inline ${match[0]}`);
  }
  if (css) postcss.parse(css).walkDecls(declaration => {
    if (!['font', 'font-size', 'font-weight'].includes(declaration.prop)) return;
    if (/var\(--type-|^(inherit|initial|unset|1em)$/.test(declaration.value)) return;
    const selector = declaration.parent.selector || '';
    // Arrows and icon glyphs are artwork, not text hierarchy. Initial-letter
    // media placeholders and legacy embedded footer styles retain art direction.
    if (/arrow|icon|marker|\[aria-hidden\]|\.journal-dot|placeholder|story-footer/.test(selector)) return;
    failures.push(`${file}: ${selector.replace(/\s+/g, ' ')} → ${declaration.prop}: ${declaration.value}`);
  });
}
if (failures.length) {
  console.error('Use shared typography roles for these declarations:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Shared typography contract passed for ${files.length} sources.`);
}
