import { pages } from '../lib/siteNavigation.js';

const page = (id) => ({ title: pages[id].label, href: pages[id].href });
const link = (title, href) => ({ title, href });

// Public destinations shared by the HTML directory and XML discovery.
// Add new permanent pages here; published collection items are loaded separately.
export const siteDirectory = [
  {
    id: 'work', title: 'Work & creative practice', href: '/work',
    description: 'Selected commissions, creative direction, collaborations and studio services.',
    links: [page('work'), page('services'), page('studio'), link('Creative consulting', '/consulting'), link('Collaborations', '/collaboration')],
  },
  {
    id: 'research', title: 'Research', href: '/research',
    description: 'Artistic research, visual culture, archives and personal knowledge systems.',
    links: [page('research'), page('academic'), link('Atlas of People & Pictures', '/atlasofpeopleandpictures'), link('Archival bootcamp portfolio', '/archival-bootcamp'), link('Invisible Punctum', '/research/invisible-punctum'), link('Second Brain research', '/research/second-brain'), link('Glyph Loom research', '/research/glyph-loom'), link('BSA photographic archives', '/research/bsa-photographic-archives')],
  },
  {
    id: 'photography', title: 'Photography', href: '/photography',
    description: 'Photographic series, exhibition documentation, personal archives and image licensing.',
    links: [page('photography'), page('portfolios'), page('licensing'), link('Behind the scenes', '/bts'), link('UK 2026 photographic diary', '/uk-2026')],
  },
  {
    id: 'films', title: 'Films & editing', href: '/films',
    description: 'Films, music videos, editing and a community for moving-image practitioners.',
    links: [page('films'), link('Supercut Club', '/supercutclub'), link('Video editing mentorship', '/video-editing-mentor'), link('Premiere Pro masterclass', '/premiere-pro-masterclass')],
  },
  {
    id: 'writing', title: 'Writing & reading', href: '/blog',
    description: 'Essays, reflections, the Morning Digest and the Friday Evenings newsletter.',
    links: [page('writing'), page('digest'), page('newsletter'), link('Subscribe by email or RSS', '/subscribe')],
  },
  {
    id: 'papers', title: 'Curated research papers', href: '/research-papers',
    description: 'An expanding reading library of academic papers, ideas and references.',
    links: [page('papers')],
  },
  {
    id: 'lab', title: 'Media Lab & experiments', href: '/lab',
    description: 'Interactive art, generative typography, gesture interfaces and creative tools.',
    links: [page('lab'), link('Punctum: photographic attention', '/lab/punctum'), link('Image Flick', '/lab/image-flick'), link('Glyph Loom', '/lab/glyph-loom'), link('Sequence Room', '/lab/sequence-room'), link('Art in Every Corner', '/lab/art-in-every-corner'), link('Right-click to Moodboard', '/lab/moodboard-capture-pipeline'), link('Obsidian Tags Interactive Explorer', '/lab/obsidian-tags-interactive-explorer'), link('Audio visualiser', '/lab/audio-visualiser')],
  },
  {
    id: 'curation', title: 'Curation & creative resources', href: '/resources',
    description: 'Tools, visual inspiration, films, immersive experiences and creative organisations.',
    links: [page('resources'), page('moodboard'), page('toolkit'), page('tools'), page('videos'), page('xr'), link('Creative Companies Database', '/curation/creative-database'), link('FTII graduation films', '/curation/ftii-graduation-films-of-famous-filmmakers')],
  },
  {
    id: 'workshops', title: 'Workshops & learning', href: '/workshops',
    description: 'Photography, filmmaking, video editing, autoethnography and Obsidian workshops.',
    links: [page('workshops'), link('Photography workshop', '/photography-workshop'), link('Filmmaking workshop', '/filmmaking-workshop'), link('Video editing workshop', '/video-editing-workshop'), link('Autoethnography workshop', '/autoethnography-workshop'), link('Obsidian workshops', '/workshops/obsidian'), page('tutoring'), link('Obsidian for researchers', '/obsidian-for-researchers'), link('Obsidian for writers', '/obsidian-for-writers'), link('Obsidian for filmmakers', '/obsidian-for-filmmakers'), link('Obsidian for founders', '/obsidian-for-founders')],
  },
  {
    id: 'about', title: 'About, biography & press', href: '/about',
    description: 'Biography, education, professional experience, awards and media coverage.',
    links: [page('about'), page('experience'), link('Education', '/education'), link('Timeline', '/timeline'), page('cv'), page('awards'), link('Apple scholarship', '/awards/apple-scholarship'), page('press'), page('mediaKit'), page('manifesto'), link('Testimonials', '/testimonials')],
  },
  {
    id: 'community', title: 'Community & opportunities', href: '/contact',
    description: 'Get in touch, explore open roles and contribute to shared notebooks.',
    links: [page('contact'), link('Opportunities', '/opportunities'), link('Careers & open roles', '/careers'), link('Shared notepad', '/notepad'), link('Collected quotes', '/quotes'), link('Guestbook', '/guestbook'), link('Supercut community', '/supercutclub/community')],
  },
  {
    id: 'studio', title: 'Podcast Studio', href: 'https://podcast.abodid.com/',
    description: 'Recording, podcast production, audiobooks and post-production in Ebbsfleet Valley, Kent.',
    links: [link('Podcast Studio overview', 'https://podcast.abodid.com/'), link('The recording studio', 'https://podcast.abodid.com/studio/'), link('Podcast production', 'https://podcast.abodid.com/podcasts/'), link('Audiobook production', 'https://podcast.abodid.com/audiobooks/'), link('Post-production', 'https://podcast.abodid.com/post-production/'), link('Artists & collaborators', 'https://podcast.abodid.com/artists/'), link('Studio pricing', 'https://podcast.abodid.com/pricing/'), link('Plan your stay', 'https://podcast.abodid.com/stay/'), link('Studio enquiries', 'https://podcast.abodid.com/enquire/'), link('Studio policies', 'https://podcast.abodid.com/policies/')],
  },
];

export const knowledgeLinks = [
  link('Obsidian Vault overview', '/obsidian-vault'),
  link('Complete vault directory', '/obsidian-vault/directory'),
  link('Abodid System Manual', '/system-manual'),
];

export const utilityLinks = [
  link('Home', '/'), link('Sitemap', '/sitemap'), link('Privacy policy', '/privacy'),
];

export const directoryPaths = [...new Set([
  ...siteDirectory.flatMap((group) => [group.href, ...group.links.map((item) => item.href)]),
  ...knowledgeLinks.map((item) => item.href), ...utilityLinks.map((item) => item.href),
].filter((path) => path.startsWith('/')))];
