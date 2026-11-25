import { createClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';
import { extractVaultNoteMetadata, detectSensitiveVaultContent, stripLegacyVaultMetadata } from '../vault-rag.js';
import { vaultNoteHref } from '../vault-paths.js';
import { getLabExperiments } from '../../data/labExperiments';
import { istDate } from '../reading/publicFeed';
import { localSubscriptionEntries } from './local';
import { dateValue, isDistributable, isObsidianContent, normalizeEntries, safeHttpUrl, terms } from './entries.js';

const env = (key: string) => import.meta.env[key] || process.env[key];
const publicClient = () => {
  const url = env('PUBLIC_SUPABASE_URL');
  const key = env('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Public content configuration is unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
};
const serviceClient = () => {
  const client = createSupabaseServiceClient();
  if (!client) throw new Error('Public index configuration is unavailable');
  return client;
};

// Avoid PostgREST's default 1,000-row cap. Order by a unique, immutable key.
export async function readAll(query: () => any) {
  const rows: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const read = () => query().range(offset, offset + pageSize - 1).abortSignal(AbortSignal.timeout(15_000));
    let result = await read();
    if (result.error && /57014|53300|timeout|timed out|fetch failed|connection|503/i.test(`${result.error.code} ${result.error.message}`)) {
      // One bounded retry for a transient read failure; never retry permissions
      // or publish a partial collection when the second read also fails.
      await new Promise((resolve) => setTimeout(resolve, 200));
      result = await read();
    }
    const { data, error } = result;
    if (error) throw new Error(`Public content read failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

const pathFor = (section: string, slug: string) => `/${section}/${encodeURIComponent(slug)}`;
const baseEntry = (row: any, section: string, feeds: string[]) => ({
  title: row.title, url: row.slug ? pathFor(section, row.slug)
    : ['films', 'research-papers'].includes(section) ? pathFor(section, String(row.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) : undefined, feeds,
  description: row.excerpt || row.description || row.abstract || row.intro,
  published: row.published_at || row.video_published_at || row.created_at,
  modified: row.updated_at,
  image: row.cover_image || row.thumbnail_url || row.image,
  categories: [...terms(row.category), ...terms(row.categories), ...terms(row.tags)],
});

async function contentEntries(id: string) {
  const db = publicClient();
  const summaries: Record<string, string> = {
    blog: 'id,title,slug,excerpt,cover_image,published,published_at,tags,category',
    research: 'id,title,slug,description,cover_image,created_at,updated_at,tags,published,visible',
    photography: 'id,title,slug,intro,cover_image,created_at,published_at,tags,category,published',
    films: 'id,title,slug,description,thumbnail_url,created_at,updated_at,video_published_at,categories,published',
  };
  const rows = (table: string, filter: (query: any) => any = (query) => query.eq('published', true)) =>
    readAll(() => filter(db.from(table).select(summaries[table] || '*')).order('id'));
  if (id === 'blog') return (await rows('blog')).filter(isDistributable).map((row) => ({
    ...baseEntry(row, 'blog', isObsidianContent(row) ? ['blog', 'obsidian'] : ['blog']),
  }));
  if (id === 'press') return (await rows('media_mentions')).map((row) => ({
    title: row.title, description: row.description || row.title, url: row.url,
    feeds: ['press'], published: row.published_at || row.created_at, modified: row.updated_at,
    author: row.publication, image: row.image_url, categories: row.categories,
  }));
  if (id === 'moodboard') return (await readAll(() => serviceClient().from('moodboard_items')
    .select('id,title,artist_name,image_url,tags,created_at,updated_at').eq('published', true).order('id'))).map((row) => ({
    title: row.title || (row.artist_name ? `Visual reference by ${row.artist_name}` : 'A new visual reference'),
    description: row.title || (row.artist_name ? `A visual reference by ${row.artist_name}, from my moodboard.` : 'A newly published reference from my visual moodboard.'),
    url: `/moodboard?photo=${encodeURIComponent(row.id)}`, feeds: ['moodboard'],
    guid: `urn:abodid:moodboard:${row.id}`, image: row.image_url,
    author: row.artist_name || 'Curated by Abodid Sahoo', categories: terms(row.tags),
    published: row.created_at, modified: row.updated_at,
  }));
  if (id === 'community') {
    const groups = await Promise.all(['ideas_notes', 'quotes'].map(async (table) =>
      (await readAll(() => db.from(table).select('id,body,created_at').order('id')))
        .filter((row) => !detectSensitiveVaultContent(row.body || '').length)
        .map((row) => ({
          title: String(row.body || '').slice(0, 100), description: row.body,
          url: `/${table === 'quotes' ? 'quotes' : 'notepad'}#note-${row.id}`,
          guid: `urn:abodid:${table}:${row.id}`, feeds: ['community'],
          published: row.created_at, author: 'Community contributor',
          categories: [table === 'quotes' ? 'Quotes' : 'Public notebook'],
        }))));
    return groups.flat();
  }
  if (id === 'research') {
    const [projects, papers] = await Promise.all([
      rows('research', (query) => query.eq('published', true).eq('visible', true)), rows('research_papers'),
    ]);
    return [
      ...projects.map((row) => baseEntry(row, 'research', ['research'])),
      ...papers.map((row) => ({ ...baseEntry(row, 'research-papers', ['research']), author: row.authors_json || row.authors })),
    ];
  }
  if (id === 'work') {
    const [photos, films, projects] = await Promise.all([
      rows('photography'), rows('films'),
      readAll(() => db.from('portfolio_public_index').select('*').order('project_id')),
    ]);
    const ids = projects.filter((row) => row.search_visible !== false).map((row) => row.project_id);
    const publications = ids.length ? await readAll(() => serviceClient().from('portfolio_project_backups')
      .select('id,project_id,created_at').in('project_id', ids).order('id')) : [];
    const dates = new Map<string, { first: string; latest: string }>();
    for (const row of publications) {
      const current = dates.get(row.project_id);
      dates.set(row.project_id, { first: current && current.first < row.created_at ? current.first : row.created_at,
        latest: current && current.latest > row.created_at ? current.latest : row.created_at });
    }
    return [
      ...photos.map((row) => ({ ...baseEntry(row, 'photography', ['work']),
        url: row.slug === 'my-life' ? '/bts' : row.slug === 'uk-2026' ? '/uk-2026' : pathFor('photography', row.slug) })),
      ...films.map((row) => baseEntry(row, 'films', ['work'])),
      ...projects.map((row) => ({ ...baseEntry(row, 'work', ['work']),
        description: row.one_line_description, image: row.cover_url, categories: terms(row.taxonomies), noindex: row.search_visible === false,
        published: dates.get(row.project_id)?.first, modified: dates.get(row.project_id)?.latest })),
    ];
  }
  if (id === 'resources') {
    const resources = (await readAll(() => serviceClient().from('hub_resources')
    .select('id,title,description,url,thumbnail_url,created_at,updated_at,status,credit_text,tags:hub_resource_tags(tag:hub_tags(name))')
    .eq('status', 'approved').order('id'))).map((row) => ({
      title: row.title, description: row.description, url: `/resources/${row.id}`, feeds: ['resources'],
      published: row.created_at, modified: row.updated_at, image: row.thumbnail_url,
      categories: row.tags?.flatMap((link: any) => terms(link.tag)),
      author: row.credit_text || 'Curated by Abodid Sahoo',
    }));
    const xr = await readAll(() => db.from('xr_showcase_items').select('id,title,description,source_url,canonical_url,primary_genre,tags,effective_image_url,published_at,created_at,updated_at')
      .eq('status', 'published').order('id'));
    return [...resources, ...xr.map((row) => ({
      title: row.title, description: row.description, url: row.canonical_url || row.source_url,
      feeds: ['resources'], published: row.published_at || row.created_at, modified: row.updated_at,
      author: 'Curated by Abodid Sahoo',
      image: row.effective_image_url, categories: [row.primary_genre, ...terms(row.tags)],
    }))];
  }
  return [];
}

async function noteEntries() {
  const db = serviceClient();
  const notes = await readAll(() => db.from('obsidian_notes')
    .select('note_id,note_title,slug,file_path,markdown_content,tags,created_at,updated_at,source_sha')
    .eq('is_public', true).not('source_sha', 'is', null).or('file_path.ilike.06-main-notes/%,file_path.ilike.6 - Main Notes/%').order('note_id'));
  return notes.flatMap((row) => {
    const metadata = extractVaultNoteMetadata(row.markdown_content || '');
    if (!isDistributable(metadata.frontmatter) || detectSensitiveVaultContent(row.markdown_content || '').length) return [];
    const title = metadata.frontmatter.title || row.note_title;
    const tags = [...terms(row.tags), ...metadata.tags, ...metadata.noteTypes];
    return [{
      title, url: vaultNoteHref((row.slug || row.file_path.split('/').pop().replace(/\.md$/i, '')).replace(/\?+$/, '')), feeds: isObsidianContent({ title, tags }) ? ['notes', 'obsidian'] : ['notes'],
      description: stripLegacyVaultMetadata(metadata.content),
      published: dateValue(metadata.frontmatter.published_at) || dateValue(metadata.date) || row.created_at,
      modified: row.updated_at, categories: tags,
      image: metadata.frontmatter.image || metadata.frontmatter.cover,
    }];
  });
}

async function readingEntries() {
  const db = serviceClient();
  return (await readAll(() => db.from('reading_digest_public_items')
    .select('id,title,url,source_name,publication_date,delivery_date,topic_names,why_it_matters,editorial_note,thumbnail_url')
    .lte('delivery_date', istDate()).order('id'))).map((row) => ({
      title: row.title, url: row.url, feeds: ['reading'], guid: `urn:abodid:reading:${row.id}`,
      description: [row.editorial_note, row.why_it_matters].filter(Boolean).join(' '),
      published: row.publication_date || row.delivery_date, author: row.source_name,
      categories: row.topic_names, image: row.thumbnail_url,
    }));
}

async function opportunityEntries() {
  const db = serviceClient();
  const { data: profile, error } = await db.from('profiles').select('id,is_public').eq('username', 'abodid').maybeSingle();
  if (error) throw error;
  if (!profile?.is_public) return [];
  // Same allowlist and access rules as /api/opportunities/public/abodid.
  const rows = await readAll(() => db.from('saved_opportunities')
    .select('id,title,source_url,canonical_url,deadline_at,content,created_at,updated_at,outcome')
    .eq('user_id', profile.id).eq('status', 'reviewing')
    .not('source_url', 'like', 'https://direct.entry/%').order('id'));
  return rows.filter((row) => row.outcome !== 'expired').map((row) => ({
    title: row.title, url: row.canonical_url || row.source_url, feeds: ['opportunities'],
    guid: `urn:abodid:opportunity:${row.id}`, description: row.content?.summary,
    published: row.created_at, modified: row.updated_at, expires: row.deadline_at || row.content?.event_date,
    categories: terms(row.content?.category),
  }));
}

export async function getSubscriptionEntries(id = 'all', site: string | URL = 'https://abodid.com') {
  const tasks: Array<Promise<any[]>> = [];
  const needs = (value: string) => id === 'all' || id === value;
  for (const section of ['blog', 'research', 'work', 'resources', 'moodboard', 'press', 'community']) {
    if (needs(section) || (id === 'obsidian' && section === 'blog')) tasks.push(contentEntries(section).catch((error) => { throw new Error(`${section}: ${error.message}`); }));
  }
  if (needs('notes') || id === 'obsidian') tasks.push(noteEntries());
  if (needs('reading')) tasks.push(readingEntries());
  if (needs('opportunities')) tasks.push(opportunityEntries());
  if (needs('lab')) tasks.push(getLabExperiments({ strict: true }).then((experiments) => experiments.map((item) => ({
    title: item.title, description: item.description, url: item.href, feeds: ['lab'],
    image: item.thumbnailPoster || (!item.video ? item.thumbnail : undefined), categories: [item.discipline],
    published: item.publishedAt, modified: item.updatedAt,
  }))));
  // Database records win over local fallback copy at the same canonical URL.
  const [remoteEntries, hiddenPages] = await Promise.all([
    Promise.all(tasks).then((groups) => groups.flat()),
    readAll(() => publicClient().from('page_metadata').select('page_path').eq('is_active', true).eq('robots_index', false).order('page_path')),
  ]);
  const hidden = new Set([...hiddenPages.map((page) => new URL(page.page_path, site).pathname),
    ...remoteEntries.filter((entry) => entry.noindex).map((entry) => new URL(entry.url, site).pathname)]);
  const entries = normalizeEntries([...remoteEntries, ...localSubscriptionEntries()]
    .filter((entry) => {
      const url = safeHttpUrl(entry.url, String(site));
      if (!url) return false;
      const parsed = new URL(url);
      const hostname = new URL(site).hostname;
      return ![hostname, `www.${hostname}`].includes(parsed.hostname) || !hidden.has(parsed.pathname);
    }), { site: String(site) });
  return id === 'all' ? entries : entries.filter((entry) => entry.feeds.includes(id));
}
