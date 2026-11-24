// Shared by discovery metadata, the subscription UI and server feed routes.
export const SUBSCRIPTION_FEEDS = Object.freeze([
  { id: 'all', title: 'All Updates', path: '/rss.xml', description: 'Writings, research, notes, creative work and discoveries in one feed.' },
  { id: 'blog', title: 'Writing & essays', path: '/feeds/blog.xml', description: 'New articles, essays and longer reflections.' },
  { id: 'obsidian', title: 'Obsidian & workflows', path: '/feeds/obsidian.xml', description: 'Articles and public notes on Obsidian, knowledge systems and workflows.' },
  { id: 'notes', title: 'Public notes', path: '/feeds/notes.xml', description: 'Ideas and connections growing in my public digital garden.' },
  { id: 'research', title: 'Research & papers', path: '/feeds/research.xml', description: 'Research projects, publications and curated papers.' },
  { id: 'lab', title: 'Lab experiments', path: '/feeds/lab.xml', description: 'Creative tools, interactive experiments and case studies.' },
  { id: 'opportunities', title: 'Opportunities', path: '/feeds/opportunities.xml', description: 'Open calls, residencies, grants and roles from my public collection.' },
  { id: 'resources', title: 'Curated resources', path: '/feeds/resources.xml', description: 'Approved tools, references and resources from the curation library.' },
  { id: 'moodboard', title: 'Visual references', path: '/feeds/moodboard.xml', description: 'Newly published images and visual discoveries from the moodboard.' },
  { id: 'reading', title: 'Morning Digest', path: '/feeds/reading.xml', description: 'Daily discoveries across art, culture, research and creative technology.' },
  { id: 'press', title: 'Press & mentions', path: '/feeds/press.xml', description: 'Interviews, features and media coverage of my practice.' },
  { id: 'community', title: 'Shared notebook', path: '/feeds/community.xml', description: 'Public thoughts and quotes contributed to the shared boards.' },
  { id: 'work', title: 'Work & photography', path: '/feeds/work.xml', description: 'Published portfolio projects, photographic series and films.' },
  { id: 'manual', title: 'System manual', path: '/feeds/manual.xml', description: 'Public documentation of how this creative ecosystem works.' },
]);

export const subscriptionFeed = (id) => SUBSCRIPTION_FEEDS.find((feed) => feed.id === id);
export const feedUrl = (feed, site = 'https://abodid.com') => new URL(feed.path, site).href;
export const readerLinks = (url) => ({
  feedly: `https://feedly.com/i/subscription/feed/${encodeURIComponent(url)}`,
  inoreader: `https://www.inoreader.com/?add_feed=${encodeURIComponent(url)}`,
});
