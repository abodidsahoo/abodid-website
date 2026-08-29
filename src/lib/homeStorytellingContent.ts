import { supabase } from "./supabase";
import { punctumImages } from "../data/punctumImages";
import {
  GESTURE_CONTROL_HERO_GIF_URL,
  GESTURE_CONTROL_VIDEO_URL,
} from "./mediaAssets";

export const cloudflareExhibitionFallbacks = punctumImages
  .map((image) => image.url)
  .filter(Boolean);

export const storytellingProjects = [
  {
    id: "into-the-flux",
    title: "Into the Flux",
    category: "Exhibition experience",
    summary: "An abandoned London garage transformed into a public exhibition in two days.",
    role: "Creative direction · spatial planning · production · documentation",
    outcome: "10,000+ visitors",
    href: "/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days",
    image: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/stories/d2ed4c3d-2f1a-4bde-83e2-088105243a54/1768230727606-into-the-flux-iba-london103.webp",
    alt: "Visitors inside the Into the Flux exhibition in London",
  },
  {
    id: "punctum",
    title: "Punctum",
    category: "Participatory research",
    summary: "An interactive study of the details in photographs that move us, stay with us and shape memory.",
    role: "Research · experience design · prototyping",
    outcome: "Live visual-attention experiment",
    href: "/research/punctum",
    image: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg",
    alt: "A photograph used in the Punctum participatory visual study",
  },
  {
    id: "bfi",
    title: "British Film Institute",
    category: "Cultural documentation",
    summary: "Human-centred photography for a four-day programme of immersive and expanded cinema.",
    role: "Photography · visual storytelling",
    outcome: "20,000+ visitors across four days",
    href: "/photography/british-film-institute-london",
    image: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/photography/covers/1769335964323_qjq8j2g9q.webp",
    alt: "Audience members experiencing an immersive programme at the British Film Institute",
  },
  {
    id: "gesture-control",
    title: "Hand Gesture Control",
    category: "Interaction prototype",
    summary: "A touch-free interface for browsing photographs as though they were physical cards.",
    role: "Concept · interaction design · prototyping",
    outcome: "Gesture and voice-led exploration",
    href: "/research/gesture-image-preview",
    heroImage: GESTURE_CONTROL_HERO_GIF_URL,
    video: GESTURE_CONTROL_VIDEO_URL,
    image: "https://assets.newatlas.com/dims4/default/83c8dc7/2147483647/strip/true/crop/1564x1043+0+19/resize/800x533!/format/webp/quality/90/?url=https%3A%2F%2Fnewatlas-brightspot.s3.amazonaws.com%2Farchive%2Fgest-1.jpg",
    alt: "A hand interacting with a gesture-controlled digital interface",
  },
  {
    id: "show-me-the-way",
    title: "Show Me the Way",
    category: "Film and visual storytelling",
    summary: "A music video shaped through cinematography, visual effects and a tactile narrative language.",
    role: "Director · DOP · Editor · VFX",
    outcome: "Broadcast on VH1 & Rolling Stone",
    href: "/films",
    image: "https://img.youtube.com/vi/fooE0W_mFSY/maxresdefault.jpg",
    alt: "Show Me the Way music video still broadcast on VH1",
  },
  {
    id: "obsidian-vault",
    title: "Obsidian Vault",
    category: "AI Knowledge Ecosystem",
    summary: "A public, searchable space for notes, questions, ideas and research.",
    role: "Information architecture · Interface",
    outcome: "A living research ecosystem",
    href: "/research/obsidian-vault",
    video: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/Obsidian_Timelapse.mp4",
    image: punctumImages[3]?.url || punctumImages[1]?.url,
    alt: "Timelapse video preview of the connected Obsidian knowledge vault",
  },
];

export const storytellingCapabilities = [
  {
    number: "01",
    title: "Creative Direction",
    summary: "Shaping research, narrative, space and interaction into one coherent experience.",
    details: ["Exhibitions and installations", "Early-stage concepts", "Participatory experiences"],
    projects: [
      { name: "Into the Flux", href: "/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days" },
    ],
  },
  {
    number: "02",
    title: "Digital Prototyping",
    summary: "Turning complex ideas into intuitive digital experiences people can explore and contribute to.",
    details: ["Interactive storytelling", "Creative technology", "Knowledge systems"],
    projects: [
      { name: "Punctum", href: "/research/punctum" },
    ],
  },
  {
    number: "03",
    title: "Visual Documentation",
    summary: "Creating photography and film that preserves atmosphere while helping organisations communicate.",
    details: ["Cultural documentation", "Films and campaigns", "Editorial storytelling"],
    projects: [
      { name: "British Film Institute", href: "/photography/british-film-institute-london" },
      { name: "Outernet London", href: "/photography/outernet-london-2025" },
    ],
  },
  {
    number: "04",
    title: "Super-Connection",
    summary: "Mapping people, ideas and opportunities, then bringing the right creative minds into the room.",
    details: ["Creative consulting", "Collaborator mapping", "Cross-cultural networks"],
    projects: [
      { name: "Hermosa Brand Film", href: "/films" },
    ],
  },
];

export const storytellingProcess = [
  { number: "01", title: "Research", text: "Understand the people, context and question beneath the brief." },
  { number: "02", title: "Concept", text: "Find the story and choose the medium it genuinely needs." },
  { number: "03", title: "Experience", text: "Shape the space, interface, image or film around participation." },
  { number: "04", title: "Connection", text: "Create a memorable encounter that starts conversations and builds community." },
];

export const communityDoorways = [
  {
    title: "Memoirs and essays",
    text: "Memoirs and essays on lived experience, culture, art and technology for emerging creatives.",
    href: "/blog",
    cta: "Read the writing",
  },
  {
    title: "Talk sessions & workshops",
    text: "Talks and hands-on filmmaking workshops focused on ethics, research and documentation.",
    href: "/workshops",
    cta: "Explore workshops",
  },
  {
    title: "Inside my thinking",
    text: "Ask an AI-powered Obsidian Vault built from notes, ideas, questions and unfinished thoughts.",
    href: "/research/obsidian-vault",
    cta: "Ask the vault",
  },
];

const fallbackBrands = [
  { id: "rca", name: "Royal College of Art", role: "Exhibitions and cultural storytelling" },
  { id: "bfi", name: "British Film Institute", role: "Cultural documentation" },
  { id: "outernet", name: "Outernet London", role: "Immersive venue" },
  { id: "frameless", name: "Frameless", role: "Immersive venue" },
  { id: "wk", name: "Wieden+Kennedy", role: "Creative collaboration" },
  { id: "pop", name: "Pursuit of Portraits", role: "Film and visual storytelling" },
  { id: "hermosa", name: "Hermosa Design Studio", role: "Brand film" },
  { id: "odisha", name: "Odisha Tourism", role: "Visual storytelling" },
];

const curatedTestimonialHighlights: Record<string, string> = {
  "saunak shah": "Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel!",
  "pranjal agrawal": "Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice.",
  "alonzo": "Abodid and his team have literally been a breath of fresh air to work with.",
  "michael": "Each session is carefully prepared and adapted to suit my learning needs, making the lessons both focused and effective.",
  "mitch longe": "He helped me think differently about how to actually build a story — how shots work together, where to make cuts, and how to use pacing.",
};

function attachTestimonialHighlight(testimonial: any) {
  const normalizedName = String(testimonial?.name || "").trim().toLowerCase();
  const matchedHighlight = Object.entries(curatedTestimonialHighlights)
    .find(([name]) => normalizedName.includes(name) || name.includes(normalizedName))?.[1];
  const content = String(testimonial?.content || "").trim();
  const firstSentence = content.split(/(?<=[.!?])\s+/)[0] || content;

  return {
    ...testimonial,
    highlightQuote: matchedHighlight || firstSentence,
  };
}

const fallbackTestimonials = [
  {
    id: "saunak-shah",
    name: "Saunak Shah",
    role: "Creative Director",
    company: "Pursuit of Portraits, NYC",
    content: "I've had the pleasure of working with Abodid on various commissioned and collaborative video projects. His work is meticulous, thorough and thoughtful; a quality that I highly appreciate. We've worked closely on several video projects for Pursuit of Portraits. Abodid has not only created stellar videos but has always elevated the brand voice, visual storytelling and overall look and feel! If there's a hunch about direction, great aesthetic and delivery time-crunch, Abodid gets it!",
  },
  {
    id: "pranjal-agrawal",
    name: "Pranjal Agrawal",
    role: "Founder & CEO",
    company: "Hermosa Design Studio",
    content: "Abodid's thoughtful and innovative approach towards producing the brand film for Hermosa was highly professional. From creating the perfect visual references to helping the entire team envision the intricacies of the project to leading a skilled and proactive film crew; Abodid made sure the visual storytelling of the film was aptly aligned to the brand's voice. I look forward to working with him again and recommend him to anyone seeking a dedicated and creative mind on board.",
  },
  {
    id: "alonzo",
    name: "Alonzo",
    role: "Singer-Songwriter",
    company: "Independent Singer in LA",
    content: "Abodid and his team have literally been a breath of fresh air to work with. From the very beginning, Abodid sent a personal video of him breaking down the budget options and rates. This made it so easy to decide on the style of the video I wanted. He and his team were so professional and they stayed in communication giving me updates. My lyric video turned out to be so awesome and I am so happy with it. I will definitely be working with Abodid again.",
  },
  {
    id: "michael",
    name: "Michael",
    role: "Filmmaker",
    company: "London",
    content: "Abodid has been a highly supportive and dedicated tutor. Each session is carefully prepared and adapted to suit my learning needs, making the lessons both focused and effective. He explains key principles and concepts clearly, using practical examples that help me understand and apply what I am learning.\n\nHis patience, kindness, and attention to detail have made a real difference to my progress. I have already gained a great deal from his classes and look forward to continuing to develop my editing skills with his guidance.",
  },
  {
    id: "mitch-longe",
    name: "Mitch Longe",
    role: "Travel Filmmaker",
    company: "Australia",
    content: "I had a great session with Abodid — Before we even met, he’d taken the time to go through a huge amount of my footage and had picked out some absolute gems that I hadn’t even recognised myself. He also picked up on themes running through my footage that I hadn’t consciously considered, and showed me how they could become part of the story.\n\nWhat I found most valuable was that he didn’t just focus on the technical side of editing. He helped me think differently about how to actually build a story — how shots can work together, where to make cuts, how to create transitions and how to use pacing to give the video more impact.\n\nI came away from the session with a much clearer idea of how to approach my edit, but more importantly, a different way of looking at my own footage and thinking about storytelling. It was a really valuable session and I’m already looking forward to the next one. I’d definitely recommend him to anyone looking to take their editing and filmmaking to the next level.",
  },
].map(attachTestimonialHighlight);

export async function getHomeStorytellingContent() {
  const [brandResult, testimonialResult] = await Promise.allSettled([
    supabase.from("brands").select("id,name,logo_url,role,category,display_order").order("display_order", { ascending: true }).limit(100),
    supabase.from("testimonials").select("id,name,role,company,content,created_at").eq("is_approved", true).order("created_at", { ascending: false }),
  ]);

  const brands = brandResult.status === "fulfilled" && !brandResult.value.error && brandResult.value.data?.length
    ? brandResult.value.data
    : fallbackBrands;

  const placeholderNames = new Set(["sarah jenkins", "michael chen", "emily davis", "david kim", "jessica lee"]);
  const fetchedTestimonials = testimonialResult.status === "fulfilled" && !testimonialResult.value.error
    ? (testimonialResult.value.data || []).filter((testimonial: any) => !placeholderNames.has(String(testimonial?.name || "").trim().toLowerCase()))
    : [];

  const testimonials = fetchedTestimonials.length
    ? fetchedTestimonials.map(attachTestimonialHighlight)
    : fallbackTestimonials;

  return {
    hero: {
      name: "Abodid Sahoo",
      location: "London, Bengaluru",
      heading: "Creative Director, Artist and Researcher.",
      statement: "I turn stories into participatory experiences that help people connect.",
      lede: "Across exhibitions, installations, films and digital experiences, I create research-driven work that is intuitive, accessible and designed to spark conversation.",
    },
    projects: storytellingProjects,
    capabilities: storytellingCapabilities,
    process: storytellingProcess,
    community: communityDoorways,
    brands,
    testimonials,
  };
}

export type HomeStorytellingContent = Awaited<ReturnType<typeof getHomeStorytellingContent>>;
