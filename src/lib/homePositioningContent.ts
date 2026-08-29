import { supabase } from "./supabase";
import { getPublishedPortfolioIndex } from "./portfolio/services.js";
import photographyPortfolios from "../data/photographyPortfolios.generated.json";
import { GESTURE_CONTROL_VIDEO_URL } from "./mediaAssets";

export interface PositioningProject {
  id: string;
  slug: string;
  title: string;
  pillar: "Spatial & Exhibition" | "Interactive & Systems" | "Visual Culture & Film";
  role: string;
  context: string;
  metric: string;
  coverUrl: string;
  coverAlt: string;
  href: string;
  video?: string;
  featured?: boolean;
}

export const positioningPillars = [
  {
    id: "spatial",
    number: "01",
    title: "Spatial & Exhibition Architecture",
    description: "Designing immersive physical environments, experiential venues, and cultural exhibitions from raw concept to build and visitor flow.",
    tags: ["Venue Transformation", "Spatial Media", "Exhibition Production", "Visitor Experience"],
  },
  {
    id: "systems",
    number: "02",
    title: "Digital Systems & Interaction Design",
    description: "Architecting interactive web experiences, research prototypes, and connected Obsidian knowledge systems for high-complexity workflows.",
    tags: ["Interactive Prototypes", "Obsidian Vaults", "Creative Technology", "Interface Design"],
  },
  {
    id: "culture",
    number: "03",
    title: "Visual Culture & Narrative Direction",
    description: "Documentary photography, brand films, and editorial campaigns capturing cultural phenomena and institutional milestones across London and worldwide.",
    tags: ["Editorial Photography", "Documentary Film", "Campaign Direction", "Brand Voice"],
  },
];

export const flagshipProjects: PositioningProject[] = [
  {
    id: "into-the-flux",
    slug: "into-the-flux",
    title: "Into the Flux: Garage to Cultural Landmark",
    pillar: "Spatial & Exhibition",
    role: "Exhibition Designer & Creative Lead",
    context: "Commissioned by International Body of Art (IBA)",
    metric: "10,000+ visitors in 48 hours",
    coverUrl: "https://photos.abodid.com/originals/exhibition-photos/into-the-flux-iba-exhibition-space-london-abodid-32.jpg",
    coverAlt: "Into the Flux exhibition space in London",
    href: "/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days",
    featured: true,
  },
  {
    id: "invisible-punctum",
    slug: "invisible-punctum",
    title: "Punctum: Cognitive Attention in Visual Media",
    pillar: "Interactive & Systems",
    role: "Interaction Designer & Technologist",
    context: "Interactive Study on Visual Theory & AI",
    metric: "Live participatory experiment",
    coverUrl: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg",
    coverAlt: "Punctum interactive experiment interface",
    href: "/research/punctum",
    featured: true,
  },
  {
    id: "outernet-london-2025",
    slug: "outernet-london-2025",
    title: "Outernet London: Immersive Media Experience",
    pillar: "Spatial & Exhibition",
    role: "Spatial Media Specialist",
    context: "High-throughput cultural landmark",
    metric: "Audiences from 100+ countries",
    coverUrl: "https://photos.abodid.com/originals/exhibition-photos/rca-outernet-digital-direction-2024-gradshow-abodid-18.jpg",
    coverAlt: "Outernet London spatial installation",
    href: "/photography/outernet-london-2025",
  },
  {
    id: "british-film-institute-london",
    slug: "british-film-institute-london",
    title: "British Film Institute (BFI) Campaign",
    pillar: "Visual Culture & Film",
    role: "Visual Director & Lead Photographer",
    context: "Flagship institutional programme",
    metric: "20,000+ visitors across 4 days",
    coverUrl: "https://photos.abodid.com/originals/event-photos/bfi-lff-expanded-2024-immersive-art-exhibition-london-photography-abodid-sahoo-12.jpg",
    coverAlt: "BFI London Film Festival Expanded documentation",
    href: "/photography/british-film-institute-london",
  },
  {
    id: "gesture-image-preview",
    slug: "gesture-image-preview",
    title: "Hand Gesture Interface Experiment",
    pillar: "Interactive & Systems",
    role: "Creative Technologist & UI Engineer",
    context: "MediaPipe Computer Vision prototype",
    metric: "Zero-touch spatial browsing",
    coverUrl: "https://assets.newatlas.com/dims4/default/83c8dc7/2147483647/strip/true/crop/1564x1043+0+19/resize/800x533!/format/webp/quality/90/?url=https%3A%2F%2Fnewatlas-brightspot.s3.amazonaws.com%2Farchive%2Fgest-1.jpg",
    coverAlt: "Gesture control interface prototype",
    href: "/research/gesture-image-preview",
    video: GESTURE_CONTROL_VIDEO_URL,
  },
  {
    id: "uncanny-comforts-with-emma",
    slug: "uncanny-comforts-with-emma",
    title: "Uncanny Comforts: Editorial Direction",
    pillar: "Visual Culture & Film",
    role: "Creative Director & Photographer",
    context: "Experimental tactile fashion study",
    metric: "Featured editorial collaboration",
    coverUrl: "https://photos.abodid.com/originals/editorial-fashion-photos/uncanny-comforts-emma-rca-fashion-editorial-london-abodid-sahoo-01.jpg",
    coverAlt: "Uncanny Comforts fashion editorial",
    href: "/photography/uncanny-comforts-with-emma",
  },
];

export const studioEngagements = [
  {
    group: "Spatial & Experience Design",
    title: "Exhibition Architecture & Venue Transformation",
    summary: "End-to-end spatial planning, interactive installation design, lighting choreography, and visitor experience engineering for cultural events and institutions.",
    scope: "Conceptual direction, spatial layout, fabrication coordination, on-site execution.",
    deliverable: "Complete experiential installation + archival documentation.",
    examples: [
      { label: "Into the Flux (IBA)", href: "/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days" },
      { label: "RCA Gradshow Spatial Media", href: "/photography/digital-direction-rca-gradshow-in-white-city" },
    ],
    href: "#enquiry",
  },
  {
    group: "Digital Systems & Prototypes",
    title: "Web-based Storytelling & Interactive Prototypes",
    summary: "Bespoke digital experiences, micro-tools, and sensory web applications built with modern frontend systems and AI integration to convey complex narratives.",
    scope: "Narrative architecture, UX/UI design, interactive development, deployment.",
    deliverable: "Responsive web experience / working experimental prototype.",
    examples: [
      { label: "Punctum Visual Attention Lab", href: "/research/punctum" },
      { label: "Obsidian Knowledge Vault", href: "/research/obsidian-vault" },
      { label: "Gesture Navigation Stack", href: "/research/gesture-image-preview" },
    ],
    href: "#enquiry",
  },
  {
    group: "Systems Architecture & Advisory",
    title: "Knowledge Systems & Research Vault Engineering",
    summary: "Bespoke Obsidian knowledge graphs and cognitive synthesis systems designed for directors, principal researchers, and creative studios managing massive reference vaults.",
    scope: "Taxonomy design, automated indexing, graph schemas, personalized onboarding.",
    deliverable: "Production-ready Obsidian system + team workflow guide.",
    examples: [
      { label: "Explore Obsidian Systems & Tutoring", href: "/obsidian-tutoring" },
      { label: "Research Consulting", href: "/obsidian-tutoring#consulting" },
    ],
    href: "/obsidian-tutoring",
  },
  {
    group: "Visual Direction & Narrative",
    title: "Institutional Campaigns & Editorial Direction",
    summary: "High-fidelity documentary photography and brand storytelling capturing pivotal exhibitions, cultural festivals, and brand milestones with distinctive human atmosphere.",
    scope: "Creative treatment, live documentation, color grading, multi-platform media package.",
    deliverable: "High-resolution curated archive for international press and marketing.",
    examples: [
      { label: "British Film Institute Campaign", href: "/photography/british-film-institute-london" },
      { label: "Outernet London", href: "/photography/outernet-london-2025" },
    ],
    href: "#enquiry",
  },
];

const curatedHighlights: Record<string, string> = {
  "saunak shah": "Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
  "pranjal agrawal": "Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice. I recommend him to anyone seeking a dedicated and creative mind.",
  "alonzo": "Abodid and his team have literally been a breath of fresh air to work with. Clear communication, visionary execution, and seamless delivery.",
};

const fallbackTestimonials = [
  {
    id: "saunak-shah",
    name: "Saunak Shah",
    role: "Founder & Creative Director",
    company: "Pursuit of Portraits (NYC)",
    content: "I've had the pleasure of working with Abodid on various commissioned and collaborative video projects. His work is meticulous, thorough and thoughtful; a quality that I highly appreciate. Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
    highlightQuote: "Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
  },
  {
    id: "pranjal-agrawal",
    name: "Pranjal Agrawal",
    role: "Founder & CEO",
    company: "Hermosa Design Studio",
    content: "Abodid's thoughtful and innovative approach towards producing the brand film for Hermosa was highly professional. From creating the perfect visual references to helping the entire team envision the intricacies of the project to leading a skilled film crew; Abodid made sure the visual storytelling was aptly aligned to our brand voice.",
    highlightQuote: "Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice.",
  },
  {
    id: "alonzo",
    name: "Alonzo",
    role: "Artist & Performer",
    company: "Los Angeles",
    content: "Abodid and his team have literally been a breath of fresh air to work with. From the initial conceptual breakdown to final execution, the communication was seamless and the creative output exceeded every expectation.",
    highlightQuote: "Abodid and his team have literally been a breath of fresh air to work with.",
  },
];

export async function getHomePositioningContent() {
  const [brandResult, testimonialResult] = await Promise.allSettled([
    supabase.from("brands").select("id,name,logo_url,role,category,display_order").order("display_order", { ascending: true }).limit(100),
    supabase.from("testimonials").select("id,name,role,company,content,created_at").eq("is_approved", true).order("created_at", { ascending: false }),
  ]);

  const brands = brandResult.status === "fulfilled" && !brandResult.value.error && brandResult.value.data?.length
    ? brandResult.value.data
    : [
        { id: "1", name: "Wieden+Kennedy", role: "Creative Direction" },
        { id: "2", name: "British Film Institute", role: "Cultural Documentation" },
        { id: "3", name: "Royal College of Art", role: "Spatial Media & Exhibitions" },
        { id: "4", name: "Outernet London", role: "Immersive Venue" },
        { id: "5", name: "Uniqlo", role: "Brand Campaign" },
        { id: "6", name: "Budweiser", role: "Film & Visual Direction" },
        { id: "7", name: "International Body of Art", role: "Exhibition Production" },
        { id: "8", name: "Hermosa Studio", role: "Brand Film" },
      ];

  const rawTestimonials = testimonialResult.status === "fulfilled" && !testimonialResult.value.error && testimonialResult.value.data?.length
    ? testimonialResult.value.data
    : fallbackTestimonials;

  const testimonials = rawTestimonials.map((t: any) => {
    const nameKey = String(t.name || "").toLowerCase();
    let highlight = t.highlightQuote || "";
    for (const [key, quote] of Object.entries(curatedHighlights)) {
      if (nameKey.includes(key)) {
        highlight = quote;
        break;
      }
    }
    if (!highlight) {
      const firstSentence = String(t.content || "").split(/(?<=[.!?])\s+/)[0];
      highlight = firstSentence && firstSentence.length < 180 ? firstSentence : t.content;
    }
    return { ...t, highlightQuote: highlight };
  });

  return {
    hero: {
      location: "London · India · Available Worldwide",
      name: "Abodid and Co",
      title: "Creative Direction, Spatial Design & Interactive Systems",
      heading: "A studio for spatial environments, interactive systems & visual culture.",
      lede: "Abodid and Co bridges physical exhibition architecture, experimental digital prototypes, and documentary storytelling — creating unforgettable human experiences for institutions, brands, and cultural leaders.",
    },
    pillars: positioningPillars,
    projects: flagshipProjects,
    engagements: studioEngagements,
    brands,
    testimonials,
  };
}

export type HomePositioningContent = Awaited<ReturnType<typeof getHomePositioningContent>>;
