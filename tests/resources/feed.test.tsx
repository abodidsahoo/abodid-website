import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { load } from 'cheerio';
import ResourceFeed from '../../src/components/resources/ResourceFeed';
import type { HubResource } from '../../src/lib/resources/types';

vi.mock('../../src/lib/resources/db', () => ({ getApprovedResources: vi.fn() }));

const resource = (id: string, overrides: Partial<HubResource> = {}): HubResource => ({
  id, title: `Resource ${id}`, description: null, url: `https://example.com/${id}`,
  created_at: '2026-09-03', updated_at: '2026-09-03', submitted_by: null,
  status: 'approved', audience: 'Designer', thumbnail_url: null, credit_text: null,
  ...overrides,
});
const resources = [
  resource('first', { title: 'Colour library', description: 'Useful palettes', tags: [{ id: 'tag', name: 'Colour' }] }),
  resource('second', { title: 'Film archive', audience: 'Filmmaker' }),
  resource('third', { title: 'Reading list', audience: 'Researcher', description: 'Essays about colour' }),
];
const render = (props: Partial<React.ComponentProps<typeof ResourceFeed>> = {}) =>
  load(renderToStaticMarkup(<ResourceFeed initialResources={resources} variant="editorial" {...props} />));

describe('Resource Hub editorial feed', () => {
  it('preserves resource order, detail links, submission destination and all audience options', () => {
    const $ = render();
    expect($('.resource-card-react').map((_, el) => $(el).attr('href')).get()).toEqual([
      '/resources/first', '/resources/second', '/resources/third',
    ]);
    expect($('.submit-to-hub-btn').attr('href')).toBe('/resources/submit');
    expect($('.filter-chip')).toHaveLength(7);
    expect($('[role="status"]').text()).toBe('3 resources');
  });

  it('retains linked audience state and exposes the selected filter accessibly', () => {
    const $ = render({ initialAudience: 'Filmmaker' });
    expect($('.resource-card-react')).toHaveLength(1);
    expect($('.title').text()).toBe('Film archive');
    expect($('.filter-chip[aria-pressed="true"]').text()).toBe('Filmmaker');
    expect($('.resource-clear').text()).toBe('Clear filters');
  });

  it('searches title, description and tags without surrounding whitespace or case sensitivity', () => {
    const $ = render({ initialQuery: '  COLOUR  ' });
    expect($('.resource-card-react')).toHaveLength(2);
    expect($('input').attr('value')).toBe('  COLOUR  ');
    expect($('input').attr('aria-label')).toBe('Search resources');
    expect($('.resource-card-react').last().attr('href')).toBe('/resources/third');
  });

  it('combines audience and search filters', () => {
    const $ = render({ initialAudience: 'Researcher', initialQuery: 'colour' });
    expect($('.resource-card-react')).toHaveLength(1);
    expect($('.title').text()).toBe('Reading list');
  });

  it('provides a recoverable empty state', () => {
    const $ = render({ initialQuery: 'no-such-resource' });
    expect($('.resource-card-react')).toHaveLength(0);
    expect($('[role="status"]').text()).toBe('0 resources');
    expect($('.resource-empty').text()).toContain('No matches found.');
    expect($('.resource-empty button').text()).toBe('Clear Filters');
  });

  it('preserves the original non-editorial presentation for existing consumers', () => {
    const $ = render({ variant: 'default', showSearch: false });
    expect($('.resource-card-react')).toHaveLength(3);
    expect($('.resource-discovery')).toHaveLength(0);
    expect($('.resource-results-heading')).toHaveLength(0);
    expect($('.hover-cue')).toHaveLength(3);
  });
});
