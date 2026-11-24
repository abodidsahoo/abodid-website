// Each destination belongs to one section. Headers, menus and page search use the same labels.
export const pages = {
  work: { label: "Selected work", href: "/work", terms: "portfolio projects commissions" },
  photography: { label: "Photography", href: "/photography", terms: "photos pictures galleries exhibitions" },
  portfolios: { label: "Photography portfolios", href: "/photography-portfolio", terms: "photographs collections albums" },
  films: { label: "Films", href: "/films", terms: "film video filmmaking cinematography music videos" },
  research: { label: "Research", href: "/research", terms: "artistic research projects" },
  lab: { label: "Media Lab", href: "/lab", terms: "interactive experiments prototypes creative technology" },
  papers: { label: "Curated research papers", href: "/research-papers", terms: "publications academic papers" },
  academic: { label: "Academic portfolio", href: "/academic-portfolio", terms: "scholarship academia" },
  vault: { label: "Obsidian Vault", href: "/obsidian-vault", terms: "notes second brain knowledge systems" },
  toolkit: { label: "Creative Tech Toolkit", href: "/creative-tech-toolkit", terms: "technology learning design interaction storytelling" },
  writing: { label: "Writing", href: "/blog", terms: "blog journal stories essays articles" },
  digest: { label: "Morning Digest", href: "/reading", terms: "reading curated links" },
  resources: { label: "Curated resources", href: "/resources", terms: "curation bookmarks library" },
  moodboard: { label: "Moodboard", href: "/moodboard", terms: "images visual inspiration references" },
  tools: { label: "Tools", href: "/tools", terms: "software toolkit" },
  videos: { label: "Must Watch Videos", href: "/curated-videos", terms: "curated video playlist" },
  xr: { label: "XR Showcase", href: "/xr-showcase", terms: "virtual reality immersive augmented reality" },
  newsletter: { label: "Newsletter", href: "/newsletter", terms: "email subscribe digest" },
  services: { label: "Services", href: "/services", terms: "hire commissions creative direction production" },
  studio: { label: "Abodid & Co. studio", href: "/studio", terms: "agency production studio" },
  workshops: { label: "Workshops", href: "/workshops", terms: "learning teaching classes courses training" },
  tutoring: { label: "Obsidian tutoring", href: "/obsidian-tutoring", terms: "notes mentoring workshop" },
  licensing: { label: "Photo licensing", href: "/licensing", terms: "image rights usage credit permission photographer" },
  contact: { label: "Contact", href: "/contact", terms: "email enquiry collaboration get in touch hire" },
  about: { label: "About Abodid", href: "/about", terms: "artist biography bio" },
  experience: { label: "Experience", href: "/experience", terms: "career employment background" },
  cv: { label: "CV", href: "/cv", terms: "résumé resume curriculum vitae" },
  awards: { label: "Awards", href: "/awards", terms: "recognition achievements" },
  press: { label: "Press mentions", href: "/press", terms: "media coverage interviews" },
  mediaKit: { label: "Media kit", href: "/media-kit", terms: "press kit portraits biographies speaker" },
  manifesto: { label: "Manifesto", href: "/manifesto", terms: "principles beliefs" },
};

const photoBase = "https://assets.abodid.com/photos/variants";
export const thumbnails = {
  photography: `${photoBase}/exhibition-photos/800/into-the-flux-iba-london103-baac9bdf57.webp`,
  films: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-thumbnails/show-me-the-way-vh1-india.webp",
  lab: "/images/research/glyph-loom-cover.png",
};

// Page artwork takes priority. Pages without a cover use the small, existing
// Cloudflare exhibition variants, with a distinct photograph per destination.
const exhibitionBase = `${photoBase}/exhibition-photos/800`;
export const pageImages = {
  work: `${exhibitionBase}/into-the-flux-iba-london103-baac9bdf57.webp`,
  photography: `${exhibitionBase}/into-the-flux-iba-london88-28d7f7c01f.webp`,
  films: thumbnails.films,
  portfolios: `${exhibitionBase}/rca-grad-show-truman-brewery-abodid-97-3853dd699c.webp`,
  research: "/images/research-portfolio/ghosts-cover.jpg",
  lab: thumbnails.lab,
  papers: `${exhibitionBase}/rca-2023-mres-exhibition-13-92f20e736a.webp`,
  academic: "/images/research-portfolio/photogrammetry-poster.jpg",
  vault: "/images/obsidian-timelapse/frame-1.webp",
  toolkit: `${exhibitionBase}/rca-digital-direction-2024-gradshow-abodid-110-9e7cf71fec.webp`,
  writing: "/images/research-portfolio/cloud-installation.jpg",
  digest: `${exhibitionBase}/rca-2023-ma-print-exhibition-7-31a8897a8a.webp`,
  resources: `${exhibitionBase}/hidden-exhibition-rca-abodid-17-72de495288.webp`,
  moodboard: `${exhibitionBase}/breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp`,
  tools: `${exhibitionBase}/rca-digital-direction-2024-gradshow-abodid-128-fb47103468.webp`,
  videos: `${exhibitionBase}/rca-outernet-digital-direction-2024-gradshow-abodid-31-db2a6e5cd2.webp`,
  xr: `${exhibitionBase}/rca-outernet-digital-direction-2024-gradshow-abodid-18-5f1b5ce734.webp`,
  newsletter: "/images/friday-evenings-digest.webp",
  contact: `${exhibitionBase}/rca-2023-ting-photoshoot-collab-9-29517ab5fa.webp`,
  services: `${exhibitionBase}/into-the-flux-iba-london25-c63d120285.webp`,
  workshops: "/images/workshops/nift-2026/retail-window-960.webp",
  studio: `${exhibitionBase}/rca-2023-ting-photoshoot-collab-14-d25824f9d5.webp`,
  tutoring: "/images/obsidian-timelapse/frame-3.webp",
  licensing: `${exhibitionBase}/into-the-flux-iba-london64-b2eb638e38.webp`,
  about: `${photoBase}/landing-page-01/800/35-img-0652-edited-comp-0200b8a693.webp`,
  experience: `${exhibitionBase}/rca-grad-show-truman-brewery-abodid-105-858f08c691.webp`,
  cv: `${exhibitionBase}/rca-2023-mres-exhibition-5-d120ac9560.webp`,
  awards: `${exhibitionBase}/rca-grad-show-truman-brewery-abodid-118-f263e66352.webp`,
  press: `${exhibitionBase}/rca-digital-direction-2024-gradshow-abodid-146-71558b1e9e.webp`,
  mediaKit: `${exhibitionBase}/rca-2023-ting-photoshoot-collab-22-d4ca79b9b1.webp`,
  manifesto: `${exhibitionBase}/hidden-exhibition-rca-abodid-35-736387d606.webp`,
};

export const sections = [
  {
    id: "work", name: "Creative work", short: "Work", examples: ["photography", "films"],
    links: ["work", "photography", "films", "portfolios"],
    feature: { image: thumbnails.photography, title: "Into the Flux, London", href: "/work/into-the-flux" },
  },
  {
    id: "research", name: "Research & Lab", short: "Research", examples: ["lab", "academic"],
    links: ["research", "lab", "papers", "academic", "vault", "toolkit"],
    feature: { image: thumbnails.lab, title: "Glyph Loom", href: "/lab/glyph-loom" },
  },
  {
    id: "writing", name: "Writing & curation", short: "Writing", examples: ["digest", "moodboard"],
    links: ["writing", "digest", "resources", "moodboard", "tools", "videos", "xr", "newsletter"],
    feature: { image: "/images/research-portfolio/cloud-installation.jpg", title: "My iCloud archive, exhibited in London", href: "/blog/i-transformed-over-80000-images-of-my-icloud-archive-into-an-exhibition-in-london" },
  },
  {
    id: "collaborate", name: "Work together", short: "Collaborate", examples: ["services", "workshops"],
    links: ["contact", "services", "workshops", "studio", "tutoring", "licensing"],
    feature: { image: "/images/workshops/nift-2026/retail-window-960.webp", title: "Visual storytelling workshops", href: "/workshops" },
  },
  {
    id: "about", name: "Biography & press", short: "About", examples: ["cv", "press"],
    links: ["about", "experience", "cv", "awards", "press", "mediaKit", "manifesto"],
    feature: { image: `${photoBase}/landing-page-01/800/35-img-0652-edited-comp-0200b8a693.webp`, title: "Meet Abodid Sahoo", href: "/about" },
  },
];
