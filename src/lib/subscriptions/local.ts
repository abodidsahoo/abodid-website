import matter from 'gray-matter';
import { careerRoles } from '../../data/careers';
import { curatedVideos } from '../../data/curatedVideos';
import { ftiiStudentFilms } from '../../data/ftiiStudentFilms';
import creativeCompanies from '../../data/creativeCompanies.json';
import { researchProjects } from '../../data/researchPortfolio';
import { storytellingProjects } from '../homeStorytellingContent';
import { cleanDisplayTitle } from '../systemManual';
import { excerpt, isDistributable } from './entries.js';

// Vite bundles these sources. Feed requests never depend on a server filesystem.
const manualFiles = import.meta.glob('/docs/system-manual/abodid-system-manual/**/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const researchFiles = import.meta.glob('/src/pages/research/**/*.astro', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

export function localSubscriptionEntries() {
  const entries: any[] = [];
  for (const film of ftiiStudentFilms) entries.push({
    title: film.title, description: film.description, url: `https://www.youtube.com/watch?v=${film.youtubeId}`,
    feeds: ['resources'], image: `https://img.youtube.com/vi/${film.youtubeId}/hqdefault.jpg`,
    author: film.names, categories: ['FTII student films', film.genre],
  });
  for (const [country, categories] of Object.entries(creativeCompanies)) {
    for (const [category, companies] of Object.entries(categories)) {
      for (const company of companies) {
        if (!company.website) continue;
        entries.push({ title: company.company_name, description: company.overview,
          url: /^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`,
          feeds: ['resources'], categories: ['Creative companies', country, category], author: 'Curated by Abodid Sahoo' });
      }
    }
  }
  for (const video of curatedVideos) {
    const embed = new URL(video.embedUrl);
    const videoId = embed.pathname.split('/').pop();
    entries.push({
      title: video.title, description: `A film from my personal screening list: ${video.title}.`,
      url: embed.hostname === 'player.vimeo.com' ? `https://vimeo.com/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
      feeds: ['resources'], image: video.thumbnailUrl, author: 'Curated by Abodid Sahoo', categories: ['Curated videos'],
    });
  }
  for (const [file, markdown] of Object.entries(manualFiles)) {
    const relative = file.split('/abodid-system-manual/')[1];
    if (!/^(?:[^/]+|\d{2}-[^/]+\/[^/]+)\.md$/.test(relative)) continue;
    const { data, content } = matter(markdown);
    const status = content.match(/^Status:\s*(.+)$/m)?.[1];
    if (!isDistributable({ ...data, status: data.status || status })) continue;
    const slug = relative.includes('/') ? relative.replace(/\.md$/, '')
      : relative === 'README.md' ? 'overview' : relative.replace(/\.md$/, '').toLowerCase();
    const title = cleanDisplayTitle(data.title || content.match(/^#\s+(.+)$/m)?.[1] || slug);
    entries.push({
      title, url: `/system-manual/${slug}`, feeds: ['manual'],
      description: excerpt(content.replace(/^#.*$|^(?:Status|Last Updated|Last Audited):.*$/gm, '')),
      published: data.published_at || data.date || data.created,
      modified: data.updated || content.match(/^Last (?:Updated|Audited):\s*(\d{4}-\d{2}-\d{2})/m)?.[1],
      categories: ['System manual'],
    });
  }
  // Existing local case studies are also public fallbacks on /work/[slug].
  for (const project of storytellingProjects) entries.push({
    title: project.title, url: `/work/${project.id}`, feeds: ['work'],
    description: project.summary, image: project.image, categories: project.themes || [project.category],
  });
  for (const project of researchProjects) entries.push({
    title: project.title, url: `/work/${project.slug}`, feeds: ['work', 'research'],
    description: project.premise, image: project.images[0]?.src, categories: project.themes,
  });
  // Standalone research explanations coexist with the database collection.
  // Extract only literal public metadata, never render or execute page code.
  for (const [file, source] of Object.entries(researchFiles)) {
    if (/\[|\/admin\/|\/launch\.astro$|\/(?:projects|papers|my-papers|visual-moodboard)\.astro$/.test(file)) continue;
    if (/Astro\.redirect\(|noindex=\{true\}/.test(source)) continue;
    const title = source.match(/const (?:pageTitle|title)\s*=\s*["']([^"']+)["']/)?.[1]
      || source.match(/<(?:BaseLayout|ExperimentLayout|Layout)\s[^>]*?title="([^"]+)"/)?.[1];
    if (!title) continue;
    const description = source.match(/const description\s*=\s*["']([^"']+)["']/)?.[1]
      || source.match(/description="([^"]+)"/)?.[1]
      || source.match(/<p class="subtitle">([\s\S]*?)<\/p>/)?.[1] || title;
    const canonical = source.match(/canonicalUrl="(https:\/\/abodid\.com\/[^"]+)"/)?.[1];
    entries.push({ title, description, url: canonical || file.replace('/src/pages', '').replace(/(?:\/index)?\.astro$/, ''), feeds: ['research'] });
  }
  for (const role of careerRoles.filter((role) => role.status === 'Open')) entries.push({
    title: role.title, description: role.summary, url: `/careers/${role.slug}`,
    feeds: ['opportunities'], categories: ['Careers'],
  });
  return entries;
}
