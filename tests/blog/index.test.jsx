import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';
import BlogFilter from '../../src/components/BlogFilter.jsx';

const posts = [
  { title: 'An unabridged title about photography, research, and learning in public', href: '/blog/first', category: ['Journal', 'Research'], image: '/first.webp', published_at: '2026-08-07T00:00:00Z' },
  { title: 'Second story', href: '/blog/second', category: 'Photography', date: '14 Jan 2026' },
  { title: 'Third story', href: '/blog/third', category: ['Journal', 'Creative Technology'], published_at: 'invalid', date: 'Original date' },
];
const render = (props = {}) => load(renderToStaticMarkup(<BlogFilter posts={posts} {...props} />));

describe('Blog editorial index', () => {
  it('preserves all titles, destinations and editorial ordering', () => {
    const $ = render();
    expect($('.blog-post-card').map((_, el) => $(el).attr('href')).get()).toEqual(posts.map(post => post.href));
    expect($('.blog-card-title').map((_, el) => $(el).text()).get()).toEqual(posts.map(post => post.title));
    expect($('.blog-card-category').first().text()).toBe('Journal · Research');
    expect($('[role="status"]').text()).toBe('3 articles');
  });

  it('renders query-selected categories on the server, including slugs and mixed case', () => {
    for (const initialTag of ['creative-technology', 'CREATIVE TECHNOLOGY']) {
      const $ = render({ initialTag });
      expect($('.blog-post-card')).toHaveLength(1);
      expect($('.blog-post-card').attr('href')).toBe('/blog/third');
      expect($('.blog-topic[aria-pressed="true"] > span').first().text()).toBe('Creative Technology');
      expect($('.blog-reset')).toHaveLength(1);
      expect($('[role="status"]').text()).toBe('1 article');
    }
  });

  it('counts both array and string categories while keeping every filter available', () => {
    const $ = render({ initialTag: 'photography' });
    expect($('.blog-topic')).toHaveLength(5);
    expect($('.blog-topic').eq(1).find('.blog-topic__count').text()).toBe('02');
    expect($('.blog-topic').first().find('.blog-topic__count').text()).toBe('03');
    expect($('.blog-post-card').attr('href')).toBe('/blog/second');
  });

  it('uses unambiguous dates and preserves legacy dates safely', () => {
    const $ = render();
    expect($('time').first().text()).toBe('07 Aug 2026');
    expect($('time').first().attr('datetime')).toBe('2026-08-07T00:00:00.000Z');
    expect($('time').eq(1).text()).toBe('14 Jan 2026');
    expect($('time').last().text()).toBe('Original date');
    expect($('time').last().attr('datetime')).toBeUndefined();
  });

  it('gives links accessible titles and handles missing media without broken images', () => {
    const $ = render();
    $('.blog-post-card').each((_, el) => {
      expect($('#' + $(el).attr('aria-labelledby')).text()).toBe($(el).find('h3').text());
    });
    expect($('.blog-card-image img')).toHaveLength(1);
    expect($('.blog-card-placeholder')).toHaveLength(2);
    expect($('.blog-card-arrow[aria-hidden="true"]')).toHaveLength(3);
  });

  it('offers recovery for an unknown category and an honest empty archive', () => {
    const unknown = render({ initialTag: 'not-a-topic' });
    expect(unknown('.blog-post-card')).toHaveLength(0);
    expect(unknown('.blog-empty').text()).toContain('No articles in this topic yet.');
    expect(unknown('.blog-empty button').text()).toContain('Show all articles');
    const empty = render({ posts: [] });
    expect(empty('[role="status"]').text()).toBe('0 articles');
    expect(empty('.blog-empty').text()).toContain('New writing is on its way.');
  });
});
