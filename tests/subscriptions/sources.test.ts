import { describe, test, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, fail: '' }));
vi.mock('../../src/lib/subscriptions/local', () => ({ localSubscriptionEntries: () => [] }));
vi.mock('../../src/data/labExperiments', () => ({ getLabExperiments: async () => [] }));
vi.mock('../../src/lib/supabaseServer', () => ({ createSupabaseServiceClient: () => client }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }));

const client = {
  from(table: string) {
    let rows = [...(state.tables[table] || [])];
    let start = 0, end = rows.length;
    const query: any = {
      select: () => query,
      eq: (key: string, value: any) => { rows = rows.filter(row => row[key] === value); return query; },
      lte: (key: string, value: any) => { rows = rows.filter(row => row[key] <= value); return query; },
      not: () => query, or: () => query, order: () => query,
      range: (first: number, last: number) => { start = first; end = last + 1; return query; },
      abortSignal: async () => ({ data: rows.slice(start, end), error: state.fail === table ? { message: 'Offline' } : null }),
      maybeSingle: async () => ({ data: rows[0], error: null }),
    };
    return query;
  },
};

import { getSubscriptionEntries, readAll } from '../../src/lib/subscriptions/sources';
import { subscriptionResponse } from '../../src/lib/subscriptions/response';

beforeEach(() => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  state.fail = '';
  state.tables = {
    blog: [{ id: 'one', slug: 'workflow', title: 'Obsidian workflow', published: true, published_at: '2020-01-01', excerpt: 'Published & public' },
      { id: 'two', slug: 'draft', title: 'A draft', published: false }],
    page_metadata: [],
    obsidian_notes: [{ note_id: 'note', slug: 'note', file_path: '06-main-notes/note.md', note_title: 'Note',
      markdown_content: '---\ndate: 2019-01-01\n---\nAn original note.', is_public: true, created_at: '2020-01-01', updated_at: '2021-01-01' },
      { note_id: 'hidden', slug: 'hidden', file_path: '06-main-notes/hidden.md', markdown_content: '---\nprivate: true\n---\nHidden', is_public: true },
      { note_id: 'private', slug: 'private', is_public: false }],
    profiles: [{ id: 'owner', is_public: true, username: 'abodid' }],
    saved_opportunities: [{ id: 'opp', user_id: 'owner', title: 'Public call', source_url: 'https://example.com/call',
      created_at: '2020-01-01', status: 'reviewing', notes: 'Private personal note', content: { summary: 'Public description', meeting_url: 'https://secret.example.com' } }],
  };
});

describe('automatic public-source aggregation', () => {
  test('new publications appear in All Updates and their matching categories without a separate workflow', async () => {
    expect((await getSubscriptionEntries('blog')).length).toBe(1);
    state.tables.blog.push({ id: 'new', slug: 'new', title: 'New article', published: true, published_at: '2021-01-01' });
    const all = await getSubscriptionEntries();
    expect(all.some(entry => entry.url.endsWith('/blog/new'))).toBe(true);
    expect((await getSubscriptionEntries('obsidian')).some(entry => entry.title === 'Obsidian workflow')).toBe(true);
    expect(all.some(entry => entry.title === 'A draft')).toBe(false);
  });
  test('private frontmatter and index visibility exclude notes; edits keep original dates', async () => {
    const [original] = await getSubscriptionEntries('notes');
    expect(original.published?.toISOString()).toBe('2019-01-01T00:00:00.000Z');
    expect((await getSubscriptionEntries('notes')).length).toBe(1);
    state.tables.obsidian_notes[0].updated_at = '2022-01-01';
    const [updated] = await getSubscriptionEntries('notes');
    expect(updated.guid).toBe(original.guid);
    expect(updated.published).toEqual(original.published);
    state.tables.obsidian_notes[0].is_public = false;
    expect(await getSubscriptionEntries('notes')).toEqual([]);
  });
  test('opportunity privacy changes take effect immediately and private fields are never exported', async () => {
    const entries = await getSubscriptionEntries('opportunities');
    expect(entries.length).toBe(1);
    expect(JSON.stringify(entries)).not.toMatch(/Private personal note|secret.example/);
    state.tables.profiles[0].is_public = false;
    expect(await getSubscriptionEntries('opportunities')).toEqual([]);
  });
  test('published noindex overrides exclude the canonical page', async () => {
    state.tables.page_metadata = [{ page_path: '/blog/workflow', is_active: true, robots_index: false }];
    expect(await getSubscriptionEntries('blog')).toEqual([]);
  });
  test('visual references reuse stored tags and disappear when unpublished', async () => {
    state.tables.moodboard_items = [{ id: 'image', title: 'Reference', image_url: 'https://assets.abodid.com/ref.jpg', tags: ['Existing manual tag'], published: true, created_at: '2020-01-01' }];
    const [image] = await getSubscriptionEntries('moodboard');
    expect(image.url).toBe('https://abodid.com/moodboard?photo=image');
    expect(image.categories).toEqual(['Existing manual tag']);
    state.tables.moodboard_items[0].published = false;
    expect(await getSubscriptionEntries('moodboard')).toEqual([]);
  });
  test('pagination includes content beyond the database default limit', async () => {
    state.tables.blog = Array.from({ length: 1201 }, (_, id) => ({ id }));
    expect((await readAll(() => client.from('blog').select('*'))).length).toBe(1201);
  });
  test('one malformed public link does not take down the consolidated feed', async () => {
    state.tables.media_mentions = [{ id: 'bad', title: 'Bad link', url: 'http://[', published: true }];
    expect((await subscriptionResponse('all')).status).toBe(200);
  });
  test('XML escapes special characters, preserves legacy IDs and declares discovery metadata', async () => {
    const response = await subscriptionResponse('blog');
    const xml = await response.text();
    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(xml).toContain('Published &amp; public');
    expect(xml).toContain('<guid isPermaLink="false">https://abodid.com/blog/workflow/</guid>');
    expect(xml).toContain('rel="self"');
    expect(xml).toContain('<dc:creator>Abodid Sahoo</dc:creator>');
    expect(xml).not.toContain('/blog/draft');
  });
  test('a failed source returns a retryable error, never a successful partial feed', async () => {
    state.fail = 'blog';
    const response = await subscriptionResponse('blog');
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('300');
  });
});
