import { supabase } from "./supabase";
import { getPublishedPortfolioIndex } from "./portfolio/services.js";
import photographyPortfolios from "../data/photographyPortfolios.generated.json";

type CurationRow = {
  id: string;
  page_key: string;
  section_key: string;
  entity_type: string;
  entity_id: string | null;
  content: Record<string, unknown> | null;
  sort_order: number;
  visible: boolean;
};

const serviceFallbacks = [
  {
    slug: "creative-direction-technology",
    group: "Creative direction",
    title: "Exhibition Design",
    summary: "I design immersive experiential spaces + digital media exhibitions from concept to execution and help you hire the right people.",
    priceLabel: "Discuss an engagement",
    ctaLabel: "Send an enquiry",
    href: "#enquiry",
    examples: [
      {
        label: "Into the Flux — designing the space from scratch",
        href: "/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days",
      },
    ],
  },
  {
    slug: "web-based-storytelling-experiences",
    group: "Creative direction",
    title: "Web-based Storytelling Experiences",
    summary: "Use AI tools like Codex, Claude, etc., to create digital prototypes and functional web-based experiences to tell a story.",
    priceLabel: "Discuss a project",
    ctaLabel: "Send an enquiry",
    href: "#enquiry",
    examples: [
      { label: "Punctum", href: "/research/punctum" },
      { label: "Obsidian Vault", href: "/research/obsidian-vault" },
      { label: "Polaroid Hub", href: "/research/polaroid-hub" },
    ],
  },
  {
    slug: "exhibition-documentation",
    group: "Photography",
    title: "Exhibition Documentation",
    summary: "Photography for exhibition archives, campaigns and installation records.",
    priceLabel: "£400–£800",
    ctaLabel: "Discuss the exhibition",
    href: "#enquiry",
    examples: [
      { label: "Into the Flux", href: "/photography/into-the-flux" },
      { label: "RCA Gradshow in London", href: "/photography/rca-gradshow-in-london" },
      { label: "Digital Direction", href: "/photography/digital-direction-rca-gradshow-in-white-city" },
    ],
  },
  {
    slug: "event-photography",
    group: "Photography",
    title: "Event Photography",
    summary: "For selected public, cultural and creative events.",
    priceLabel: "£400–£800",
    ctaLabel: "Discuss the event",
    href: "#enquiry",
    examples: [
      { label: "British Film Institute", href: "/photography/british-film-institute-london" },
      { label: "Outernet London", href: "/photography/outernet-london-2025" },
      { label: "England Women Football Team", href: "/photography/england-women-football-team-wins" },
    ],
  },
  {
    slug: "editorial-fashion-series",
    group: "Photography",
    title: "Editorial and Fashion Series",
    summary: "Open to paid assignments and selected collaborations with agencies and models.",
    priceLabel: "From £500/day",
    ctaLabel: "Discuss a shoot",
    href: "#enquiry",
    examples: [
      { label: "Uncanny Comforts with Emma", href: "/photography/uncanny-comforts-with-emma" },
      { label: "Outernet Project 2025", href: "/photography/outernet-london-2025" },
    ],
  },
  {
    slug: "obsidian-tutoring",
    group: "Obsidian and research systems",
    title: "Obsidian Tutoring",
    summary: "One-to-one help for learning Obsidian and building a system you can continue using yourself.",
    priceLabel: "£60/hour",
    ctaLabel: "See tutoring and book",
    href: "/obsidian-tutoring",
  },
  {
    slug: "research-workflow-consulting",
    group: "Obsidian and research systems",
    title: "Research Workflow Consulting",
    summary: "For researchers and PhD students organising reading, notes, synthesis and writing.",
    priceLabel: "From £150/hour",
    ctaLabel: "Send an enquiry",
    href: "#enquiry",
  },
  {
    slug: "organisational-vault-design",
    group: "Obsidian and research systems",
    title: "Organisational Vault Design",
    summary: "A bespoke Obsidian structure for complex creative or professional work.",
    priceLabel: "From £150/hour",
    ctaLabel: "Send an enquiry",
    href: "#enquiry",
  },
  {
    slug: "visual-storytelling-masterclass",
    group: "Teaching",
    title: "Visual Storytelling Masterclass",
    summary: "Three sessions covering narrative building, choosing a medium, research, outreach and distribution.",
    priceLabel: "£600 · three sessions",
    ctaLabel: "Ask about the masterclass",
    href: "#enquiry",
  },
];

const workCollections = [
  { title: "Photography", href: "/photography", index: "01" },
  { title: "Film and Visual Storytelling", href: "/films", index: "02" },
  { title: "Exhibitions and Spatial Experiences", href: "/work?project_type=exhibition", index: "03" },
  { title: "Creative Technology and Systems", href: "/work?genre=technology", index: "04" },
  { title: "Art and Personal Practice", href: "/work?project_type=art", index: "05" },
];

const researchDestinations = [
  {
    kind: "Participatory experiment",
    title: "Punctum",
    href: "/research/punctum",
    status: "An interactive study of what stays with us in an image",
  },
  {
    kind: "Gesture interface",
    title: "Hand Gesture Control",
    href: "/research/gesture-image-preview",
    status: "A hand-controlled photographic browsing experiment",
  },
  {
    kind: "Knowledge microsite",
    title: "Obsidian Vault",
    href: "/research/obsidian-vault",
    status: "An interactive space for connected notes and ideas",
  },
  {
    kind: "Photographic microsite",
    title: "Polaroid Hub",
    href: "/research/polaroid-hub",
    status: "A tactile experiment for arranging and sequencing photographs",
  },
];

const fallbackPhotography = [
  "into-the-flux",
  "uncanny-comforts-with-emma",
  "british-film-institute-london",
  "cries-of-an-unmarried-widow",
].map((slug) => {
  const item = photographyPortfolios.stories.find((story) => story.slug === slug);
  return item ? {
    id: item.slug,
    slug: item.slug,
    title: item.title,
    oneLineDescription: item.labels.slice(0, 3).join(" · "),
    coverUrl: item.coverImage,
    coverAlt: item.title,
    href: item.projectHref,
    workInProgress: false,
  } : null;
}).filter(Boolean);

const commercialPhotographySelection = [
  {
    slug: "outernet-london-2025",
    kind: "Immersive venue",
    summary: "Trusted for last-minute documentation without a detailed brief at a cultural landmark visited by audiences from 100+ countries.",
  },
  {
    slug: "british-film-institute-london",
    kind: "Institutional campaign",
    summary: "Recommended to RCA's brand team for human-centred photography; featured across its website for a four-day programme welcoming 20,000+ visitors.",
  },
  {
    slug: "into-the-flux",
    kind: "Exhibition production",
    summary: "Commissioned by International Body of Art to transform a garage into a 10,000+-visitor exhibition; the documentation generated praise and referrals.",
  },
  {
    slug: "digital-direction-rca-gradshow-in-white-city",
    kind: "Graduate exhibition",
    summary: "Documenting RCA's Digital Direction graduate show during an exhibition week attracting 100,000+ visitors.",
  },
  {
    slug: "uncanny-comforts-with-emma",
    kind: "Fashion editorial",
    summary: "An experimental fashion collaboration exploring movement, texture and character.",
  },
  {
    slug: "rca-gradshow-in-london",
    kind: "Arts education",
    summary: "Artwork, installation and audience photography during RCA's 100,000+-visitor graduate-show week.",
  },
].map(({ slug, kind, summary }) => {
  const item = photographyPortfolios.stories.find((story) => story.slug === slug);
  return item ? {
    id: item.slug,
    slug: item.slug,
    title: item.title,
    oneLineDescription: summary,
    coverUrl: item.coverImage,
    coverAlt: item.title,
    href: item.projectHref,
    workInProgress: false,
    kind,
  } : null;
}).filter(Boolean);

const fallbackProjects = [
  ...fallbackPhotography,
  {
    id: "invisible-punctum",
    slug: "invisible-punctum",
    title: "Punctum",
    oneLineDescription: "Research · creative technology · interactive prototype",
    coverUrl: "",
    coverAlt: "",
    href: "/research/invisible-punctum",
    workInProgress: true,
  },
  {
    id: "do-ghosts-feel-jealous",
    slug: "do-ghosts-feel-jealous",
    title: "Do ghosts feel jealous if you miss the living ones more than them?",
    oneLineDescription: "Photography · writing · performance · film",
    coverUrl: "",
    coverAlt: "",
    href: "/research/do-ghosts-feel-jealous",
    workInProgress: true,
  },
];

const mixedWorkFallbacks = {
  film: {
    id: "film-akelapan",
    slug: "film-akelapan",
    title: "Akelapan",
    oneLineDescription: "Music video · Director of Photography · VFX Artist",
    coverUrl: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-thumbnails/akelapan.webp",
    coverAlt: "Akelapan music video",
    href: "/films",
    workInProgress: false,
    kind: "Film",
  },
  gesture: {
    id: "research-gesture-image-preview",
    slug: "gesture-image-preview",
    title: "Hand Gesture Control",
    oneLineDescription: "A hand-gesture-controlled card stack for previewing photographs with an optional voice-trigger layer.",
    coverUrl: "https://assets.newatlas.com/dims4/default/83c8dc7/2147483647/strip/true/crop/1564x1043+0+19/resize/800x533!/format/webp/quality/90/?url=https%3A%2F%2Fnewatlas-brightspot.s3.amazonaws.com%2Farchive%2Fgest-1.jpg",
    coverAlt: "Hand gesture interface research reference image",
    href: "/research/gesture-image-preview",
    workInProgress: true,
    kind: "Creative technology",
  },
  punctum: {
    id: "research-invisible-punctum",
    slug: "invisible-punctum",
    title: "Punctum",
    oneLineDescription: "An exploration of what pulls us into an image, makes us feel something and stays with us.",
    coverUrl: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg",
    coverAlt: "Punctum research project cover",
    href: "/research/punctum",
    workInProgress: true,
    kind: "Research",
  },
};

const exhibitionFallbackImages = [
  {
    url: "https://photos.abodid.com/variants/exhibition-photos/1600/breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp",
    alt: "A moving-image installation seen through visitors at an RCA exhibition",
  },
  {
    url: "https://photos.abodid.com/variants/exhibition-photos/1600/hidden-exhibition-rca-abodid-35-736387d606.webp",
    alt: "An artist seated beside an installation in a brick exhibition space",
  },
];

function contentValue(content: Record<string, unknown> | null, key: string) {
  const value = content?.[key];
  return typeof value === "string" ? value : "";
}

function mergeServices(rows: any[]) {
  const bySlug = new Map(rows.filter((row) => row?.slug).map((row) => [row.slug, row]));
  return serviceFallbacks.map((fallback) => {
    const row = bySlug.get(fallback.slug);
    if (!row) return fallback;
    const keepHomepageCreativeDirectionCopy = fallback.slug === "creative-direction-technology";
    const keepHomepageRelatedWork = keepHomepageCreativeDirectionCopy || fallback.slug === "editorial-fashion-series";
    return {
      ...fallback,
      group: keepHomepageCreativeDirectionCopy
        ? fallback.group
        : row.service_group || row.category || fallback.group,
      title: keepHomepageCreativeDirectionCopy ? fallback.title : row.title || fallback.title,
      summary: keepHomepageCreativeDirectionCopy
        ? fallback.summary
        : row.summary || row.content || fallback.summary,
      priceLabel: row.price_label || fallback.priceLabel,
      ctaLabel: row.cta_label || fallback.ctaLabel,
      href: row.cta_href || fallback.href,
      examples: keepHomepageRelatedWork
        ? fallback.examples
        : Array.isArray(row.items?.examples)
          ? row.items.examples
          : fallback.examples,
    };
  });
}

function curateProjects(projects: any[], curations: CurationRow[]) {
  const selected = curations.filter((row) => row.section_key === "selected-work" && row.entity_type === "project");
  const curated = !selected.length
    ? projects.slice(0, 6)
    : (() => {
      const byId = new Map();
      projects.forEach((project) => {
        if (project.id != null) byId.set(String(project.id), project);
        if (project.slug) byId.set(String(project.slug), project);
      });
      return selected.map((row) => {
        const project = row.entity_id ? byId.get(row.entity_id) : null;
        if (!project) return null;
        return {
          ...project,
          title: contentValue(row.content, "title") || project.title,
          oneLineDescription: contentValue(row.content, "summary") || project.oneLineDescription,
        };
      }).filter(Boolean);
    })();

  let fallbackIndex = 0;
  return curated.map((project: any) => {
    if (project?.coverUrl) return project;
    const fallback = exhibitionFallbackImages[fallbackIndex % exhibitionFallbackImages.length];
    fallbackIndex += 1;
    return {
      ...project,
      coverUrl: fallback.url,
      coverAlt: fallback.alt,
      coverIsEditorialFallback: true,
    };
  });
}

function cardMatches(left: any, right: any) {
  return ["id", "slug", "href"].some((key) => left?.[key] && right?.[key] && String(left[key]) === String(right[key]));
}

function buildMixedSelectedWork(projects: any[], films: any[], researchProjects: any[], curations: CurationRow[]) {
  const currentSelection = curateProjects(projects, curations).slice(0, 4);
  const researchBySlug = new Map(researchProjects.filter((item) => item?.slug).map((item) => [item.slug, item]));
  const gesture = researchBySlug.get("gesture-image-preview");
  const punctum = researchBySlug.get("invisible-punctum");
  const film = films[0];

  const filmMetadata = film
    ? [...(Array.isArray(film.categories) ? film.categories : []), ...(Array.isArray(film.roles) ? film.roles.slice(0, 2) : [])]
        .filter(Boolean)
        .join(" · ")
    : "";

  const additions = [
    {
      ...mixedWorkFallbacks.gesture,
      id: gesture?.id || mixedWorkFallbacks.gesture.id,
      oneLineDescription: gesture?.description || mixedWorkFallbacks.gesture.oneLineDescription,
      coverUrl: gesture?.cover_image || mixedWorkFallbacks.gesture.coverUrl,
    },
    {
      ...mixedWorkFallbacks.film,
      id: film?.id ? `film-${film.id}` : mixedWorkFallbacks.film.id,
      slug: film?.id ? `film-${film.id}` : mixedWorkFallbacks.film.slug,
      title: film?.title || mixedWorkFallbacks.film.title,
      oneLineDescription: filmMetadata || mixedWorkFallbacks.film.oneLineDescription,
      coverUrl: film?.thumbnail_url || mixedWorkFallbacks.film.coverUrl,
      coverAlt: film?.title ? `${film.title} film thumbnail` : mixedWorkFallbacks.film.coverAlt,
    },
    {
      ...mixedWorkFallbacks.punctum,
      id: punctum?.id || mixedWorkFallbacks.punctum.id,
      oneLineDescription: punctum?.description || mixedWorkFallbacks.punctum.oneLineDescription,
      coverUrl: punctum?.cover_image || mixedWorkFallbacks.punctum.coverUrl,
    },
  ];

  return additions.reduce((selection, item) => {
    if (!selection.some((existing) => cardMatches(existing, item))) selection.push(item);
    return selection;
  }, [...currentSelection]);
}

const curatedHighlights: Record<string, string> = {
  "saunak shah": "Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
  "pranjal agrawal": "Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice.",
  "alonzo": "Abodid and his team have literally been a breath of fresh air to work with.",
  "mitch longe": "He helped me think differently about how to actually build a story — how shots work together, where to make cuts, and how to use pacing.",
  "michael": "Each session is carefully prepared and adapted to suit my learning needs, making the lessons both focused and effective.",
};

function attachHighlight(testimonial: any) {
  const nameKey = String(testimonial?.name || "").trim().toLowerCase();
  let highlight = "";
  for (const [key, quote] of Object.entries(curatedHighlights)) {
    if (nameKey.includes(key) || key.includes(nameKey)) {
      highlight = quote;
      break;
    }
  }
  if (!highlight) {
    const text = String(testimonial?.content || "").trim();
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
    highlight = firstSentence && firstSentence.length < 180 ? firstSentence : text;
  }
  return {
    ...testimonial,
    highlightQuote: highlight,
  };
}

const fallbackTestimonials = [
  {
    id: "532ff076-e0c3-4bfd-b248-aa4b51632c4d",
    name: "Saunak Shah",
    role: "Creative Director",
    company: "Pursuit of Portraits, NYC",
    content: "I've had the pleasure of working with Abodid on various commissioned and collaborative video projects. His work is meticulous, thorough and thoughtful; a quality that I highly appreciate. We've worked closely on several video projects for Pursuit of Portraits. Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel! If there's a hunch about direction, great aesthetic and delivery time-crunch, Abodid gets it!",
    highlightQuote: "Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
  },
  {
    id: "897bee35-021e-418c-a383-33d551ff42c4",
    name: "Pranjal Agrawal",
    role: "Founder & CEO",
    company: "Hermosa Design Studio",
    content: "Abodid's thoughtful and innovative approach towards producing the brand film for Hermosa was highly professional. From creating the perfect visual references to helping the entire team envision the intricacies of the project to leading a skilled and proactive film crew; Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice. I look forward to working with him again and recommend him to anyone seeking a dedicated and creative mind on board.",
    highlightQuote: "Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice.",
  },
  {
    id: "84193046-a455-4a5a-81bd-156776fd7c74",
    name: "Alonzo",
    role: "Singer-Songwriter",
    company: "Independent Singer in LA",
    content: "Abodid and his team have literally been a breath of fresh air to work with. From the very beginning, Abodid sent a personal video of him breaking down the budget options and rates. This made it so easy to decide on the style of the video I wanted. He and his team were so professional and they stayed in communication giving me updates. My lyric video turned out to be so awesome and I am so happy with it. I will definitely be working with Abodid again.",
    highlightQuote: "Abodid and his team have literally been a breath of fresh air to work with.",
  },
];

export async function getHomeNextContent() {
  const [portfolioResult, curationResult, brandResult, testimonialResult, serviceResult, filmResult, researchResult] = await Promise.allSettled([
    getPublishedPortfolioIndex(),
    supabase.from("site_curations").select("*").eq("page_key", "home-next").eq("visible", true).order("section_key").order("sort_order"),
    supabase.from("brands").select("id,name,logo_url,role,category,display_order").order("display_order", { ascending: true }).limit(100),
    supabase.from("testimonials").select("id,name,role,company,content,created_at").eq("is_approved", true).order("created_at", { ascending: false }),
    supabase.from("services").select("*").eq("published", true).order("sort_order", { ascending: true }),
    supabase.from("films").select("id,title,description,thumbnail_url,video_url,roles,categories,sort_order,year").eq("published", true).order("sort_order", { ascending: true }).order("year", { ascending: false }).limit(1),
    supabase.from("research").select("id,slug,title,description,cover_image,sort_order").eq("published", true).eq("visible", true).in("slug", ["gesture-image-preview", "invisible-punctum"]),
  ]);

  const projects = portfolioResult.status === "fulfilled" && portfolioResult.value.length
    ? portfolioResult.value.map((project: any) => ({ ...project, href: `/work/${project.slug}` }))
    : fallbackProjects;
  const curations = curationResult.status === "fulfilled" && !curationResult.value.error
    ? (curationResult.value.data || []) as CurationRow[]
    : [];
  const brands = brandResult.status === "fulfilled" && !brandResult.value.error
    ? brandResult.value.data || []
    : [];

  const placeholderNames = new Set(["sarah jenkins", "michael chen", "emily davis", "david kim", "jessica lee"]);
  const rawTestimonials = testimonialResult.status === "fulfilled" && !testimonialResult.value.error
    ? (testimonialResult.value.data || []).filter((testimonial: any) => {
      const name = String(testimonial?.name || "").trim().toLowerCase();
      const company = String(testimonial?.company || "").trim().toLowerCase();
      return !placeholderNames.has(name) && company !== "techflow";
    })
    : [];

  // Prioritize Saunak Shah, Pranjal Agrawal, Alonzo and attach highlightQuote
  const sortedTestimonials = rawTestimonials.length > 0
    ? [...rawTestimonials].sort((a: any, b: any) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      if (aName.includes("saunak")) return -1;
      if (bName.includes("saunak")) return 1;
      if (aName.includes("pranjal")) return -1;
      if (bName.includes("pranjal")) return 1;
      return 0;
    })
    : fallbackTestimonials;

  const testimonials = sortedTestimonials.map(attachHighlight);

  const serviceRows = serviceResult.status === "fulfilled" && !serviceResult.value.error
    ? serviceResult.value.data || []
    : [];
  const films = filmResult.status === "fulfilled" && !filmResult.value.error
    ? filmResult.value.data || []
    : [];
  const researchProjects = researchResult.status === "fulfilled" && !researchResult.value.error
    ? researchResult.value.data || []
    : [];

  const heroCuration = curations.find((row) => row.section_key === "hero" && row.entity_type === "copy");

  return {
    hero: {
      location: "London · India · available worldwide",
      role: "Photographer and cultural documentation specialist",
      heading: "Photography for art, culture and the spaces where they happen.",
      lede: "I photograph exhibitions, galleries, festivals, fashion and cultural events—creating images that preserve the experience and help institutions communicate their work.",
    },
    selectedWork: commercialPhotographySelection,
    workCollections,
    services: mergeServices(serviceRows),
    researchDestinations,
    brands,
    testimonials,
  };
}

export type HomeNextContent = Awaited<ReturnType<typeof getHomeNextContent>>;
