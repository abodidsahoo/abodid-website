export type XRShowcaseStatus = "published" | "missing-link" | "metadata-review";

export type XRShowcaseItem = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  canonicalUrl?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  primaryGenre: string;
  tags: string[];
  source?: string;
  domain?: string;
  contentType?: string;
  status?: XRShowcaseStatus;
  featured?: boolean;
};

export const xrShowcaseFilters = [
  "All",
  "Fashion XR",
  "Augmented Reality",
  "Virtual Reality",
  "Immersive Installation",
  "Retail",
  "Travel",
  "Museums & Culture",
  "Creative Concepts",
  "Research",
  "Audience Insight",
  "Education & Mentorship",
  "Funding",
] as const;

export const xrShowcaseItems: XRShowcaseItem[] = [
  {
    id: "projection-mapping-latex",
    title: "Projection Mapping on Latex",
    description:
      "Using latex as a canvas for projected moving images and visuals as part of an installation.",
    primaryGenre: "Creative Concept",
    tags: ["Harri", "Projection Mapping", "Installation", "Creative Concept"],
    status: "missing-link",
  },
  {
    id: "cafe-buransh-mr-travel-guide",
    title: "Cafe Buransh MR Travel Guide",
    description:
      "A LumeXR mixed-reality travel case study created around Cafe Buransh.",
    url: "https://www.youtube.com/watch?v=pvh-Ith1Vrs",
    thumbnail: "/images/xr-showcase/cafe-buransh-mr-travel-guide.jpg",
    thumbnailAlt: "Cafe Buransh MR Travel Guide thumbnail",
    primaryGenre: "Travel",
    tags: ["Travel", "Mixed Reality", "Case Study"],
    source: "YouTube",
    domain: "youtube.com",
    contentType: "video",
    status: "published",
  },
  {
    id: "oxytocine-machine",
    title: "The Oxytocine Machine",
    description:
      "A project combining light installation and virtual reality to explore social connection.",
    url: "https://www.studio-vrij.com/en/projecten/oxytocine-machine",
    primaryGenre: "Immersive Installation",
    tags: ["Virtual Reality", "Light Installation", "Social XR", "Visual Reference"],
    status: "published",
  },
  {
    id: "eurydice-descent-infinity",
    title: "Eurydice, A Descent Into Infinity",
    description:
      "A VR opera with a distinctive visual style and approach to interaction.",
    url: "https://www.labiennale.org/en/cinema/2022/venice-immersive/eurydice-een-afdaling-oneindigheid-eurydice-descent-infinity",
    primaryGenre: "Virtual Reality",
    tags: ["VR Opera", "Performance", "Visual Reference"],
    source: "La Biennale di Venezia",
    domain: "labiennale.org",
    status: "metadata-review",
  },
  {
    id: "multiverse-bakery",
    title: "The Multiverse Bakery",
    description:
      "An animated virtual-reality short exploring magic, alchemy, and imagined worlds.",
    url: "https://studiosyro.com/tales-from-soda-island/the-multiverse-bakery",
    primaryGenre: "Virtual Reality",
    tags: ["VR Animation", "Immersive Film", "Visual Reference"],
    status: "published",
  },
  {
    id: "loook-ai",
    title: "loook.ai",
    description:
      "An augmented-reality mirror platform with fashion and retail applications.",
    url: "https://www.instagram.com/loook.ai/",
    primaryGenre: "Fashion XR",
    tags: ["Fashion", "Augmented Reality", "AR Mirror", "Technology Reference"],
    status: "published",
  },
  {
    id: "inside-felix-paul-studios",
    title: "Inside Felix & Paul Studios",
    description:
      "A behind-the-scenes video series about one of the most established immersive-media studios.",
    url: "https://www.youtube.com/watch?v=RIlAHMXrmHc&list=PLrgNJiDpkRKaQtwSItzSwudeW-Nr7XWg5",
    thumbnail: "/images/xr-showcase/inside-felix-paul-studios.jpg",
    thumbnailAlt: "Inside Felix & Paul Studios thumbnail",
    primaryGenre: "XR Studio",
    tags: ["Immersive Media", "Studio Practice", "Technology Reference"],
    source: "YouTube",
    domain: "youtube.com",
    contentType: "video",
    status: "published",
  },
  {
    id: "end-to-end-immersive-media",
    title: "End-to-End Immersive Media Value Proposition",
    description:
      "An immersive-media project combining exhibition-making, audiovisual production, and spatial experience.",
    url: "https://abodid.com/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days",
    primaryGenre: "Immersive Installation",
    tags: ["Installation", "Exhibition", "Immersive Media", "Case Study"],
    status: "published",
  },
  {
    id: "digital-materialism-gen-z",
    title: "Exploring Retail Through Immersive Fashion",
    description:
      "Research into digital materialism and how Gen Z audiences are creating pathways towards XR and virtual-production acceptance.",
    url: "https://www.fialondon.com/projects/digital-materialism-and-how-gen-z-are-building-pathways-to-xr-and-vp-acceptance/",
    primaryGenre: "Fashion Research",
    tags: ["Fashion", "Retail", "XR", "Virtual Production", "Mentorship", "Harri"],
    status: "published",
  },
  {
    id: "fashion-innovation-agency",
    title: "FIA - Disrupting Existing Practices in Fashion and Retail",
    description:
      "An overview of the Fashion Innovation Agency and its work across technology, fashion, retail, and emerging media.",
    url: "https://www.fialondon.com/about-the-fashion-innovation-agency/",
    primaryGenre: "Fashion Innovation",
    tags: ["Fashion", "Retail", "Mentorship", "Technology", "Harri"],
    status: "published",
  },
  {
    id: "xr-network-plus-funding",
    title: "XR Network+ Funding",
    description:
      "A funding and research network supporting innovation in extended reality.",
    url: "https://xrnetworkplus.xrstories.co.uk/",
    primaryGenre: "Funding",
    tags: ["Funding", "Research Network", "XR"],
    status: "published",
  },
  {
    id: "fyodor-golan-microsoft",
    title: "A Catwalk Show Augmented by Real-Time Computer Graphics",
    description:
      "A fashion presentation combining a physical catwalk with live, real-time computer-generated visuals.",
    url: "https://www.fialondon.com/projects/fyodor-golan-x-microsoft/",
    primaryGenre: "Fashion XR",
    tags: ["Fashion", "Real-Time Graphics", "Creative Concept", "Catwalk"],
    status: "published",
  },
  {
    id: "digital-fashion-cloth-simulation",
    title: "Digital Fashion and Cloth Simulation",
    description:
      "A collaboration exploring digital garments, cloth simulation, and fashion visualisation.",
    url: "https://www.fialondon.com/projects/sadie-clayton-x-the-fabricant-x-clo/",
    primaryGenre: "Digital Fashion",
    tags: ["Fashion", "Cloth Simulation", "The Fabricant", "CLO", "Harri"],
    status: "published",
  },
  {
    id: "steventai-ilmxlab",
    title: "Creating a Metaverse at London Fashion Week",
    description:
      "A London Fashion Week project combining fashion presentation, virtual environments, and immersive technology.",
    url: "https://www.fialondon.com/projects/steventai-x-ilmxlab/",
    primaryGenre: "Fashion XR",
    tags: ["Fashion", "Metaverse", "London Fashion Week", "Creative Concept", "Harri"],
    status: "published",
  },
  {
    id: "steventai-digitally-augmented-presentation",
    title: "STEVENTAI Debuts Digitally Augmented Fashion Presentation",
    description:
      "Coverage of STEVENTAI's digitally augmented approach to presenting a fashion collection.",
    url: "https://www.interlaced.co/article/steventai-debuts-digitally-augmented-fashion-presentation",
    primaryGenre: "Fashion XR",
    tags: ["Fashion", "Augmented Presentation", "Creative Concept", "Harri"],
    status: "published",
  },
  {
    id: "fashion-twinmotion",
    title: "Visualising Fashion in Real Time with Twinmotion",
    description:
      "A case study exploring real-time fashion visualisation using Twinmotion.",
    url: "https://www.fialondon.com/projects/visualising-fashion-in-real-time-with-twinmotion/",
    primaryGenre: "Real-Time Visualisation",
    tags: ["Fashion", "Twinmotion", "Real-Time Graphics", "Case Study", "Harri"],
    status: "published",
  },
  {
    id: "westfield-destination-2028",
    title: "Westfield Destination 2028 - A Vision for the Future of Retail",
    description:
      "A speculative project examining how future retail destinations could combine physical and digital experiences.",
    url: "https://www.fialondon.com/projects/westfield-destination-2028/",
    primaryGenre: "Future Retail",
    tags: ["Retail", "Future Experience", "Travel", "Case Study"],
    status: "published",
  },
  {
    id: "fia-mentorship-reachout",
    title: "Fashion Innovation Agency Mentorship",
    description:
      "A reference for potential mentorship, collaboration, or professional outreach.",
    url: "https://www.instagram.com/fashioninnovationagency/",
    primaryGenre: "Education & Mentorship",
    tags: ["Fashion", "Mentorship", "Professional Outreach", "Harri"],
    status: "published",
  },
  {
    id: "immersive-art-exhibitions-awful",
    title: "Immersive Art Exhibitions Are Everywhere and They're Awful",
    description:
      "A critical article examining recurring problems in commercially produced immersive art exhibitions.",
    url: "https://www.vice.com/en/article/why-immersive-art-exhibitions-are-awful/",
    primaryGenre: "Audience Insight",
    tags: ["Critical Essay", "Immersive Art", "Audience Insight"],
    status: "published",
  },
  {
    id: "rca-snap-augmented-unrealities",
    title: "RCA x Snap - Augmented UnRealities",
    description:
      "A Royal College of Art and Snap collaboration exploring experimental augmented-reality practices.",
    url: "https://www.rca.ac.uk/business/case-studies/rca-x-snap-augmented-unrealities/",
    primaryGenre: "Augmented Reality",
    tags: ["RCA", "Snap", "Augmented Reality", "Education", "Mentorship"],
    status: "published",
  },
  {
    id: "unfinished-bodies-ar-research",
    title: "Unfinished Bodies - Research on AR and Immersive Experiences",
    description:
      "Research into augmented reality, immersive experience, bodies, and curatorial practice.",
    url: "https://blogs.ed.ac.uk/s2706336_curating-2024-2025sem2/2025/03/29/026-week-11-research-on-ar-and-immersive-experiences/",
    primaryGenre: "Research",
    tags: ["Augmented Reality", "Curatorial Research", "Immersive Experience"],
    status: "published",
  },
  {
    id: "sciencedirect-immersive-technology",
    title: "ScienceDirect Article on Immersive Technology",
    description:
      "An academic reference examining immersive technology and user experience.",
    url: "https://www.sciencedirect.com/science/article/pii/S0747563221002740?via%3Dihub",
    primaryGenre: "Research",
    tags: ["Academic Research", "Immersive Technology", "Case Study"],
    status: "published",
  },
  {
    id: "immersive-multimedia-art-intelligent-vr",
    title: "Application of Immersive Multimedia Art",
    description:
      "Research into immersive multimedia art design using intelligent virtual-reality technology.",
    url: "https://www.researchgate.net/publication/391945161_Research_on_the_Application_of_Immersive_Multimedia_Art_Design_Based_on_Intelligent_VR_Technology",
    primaryGenre: "Research",
    tags: ["Academic Research", "Virtual Reality", "Multimedia Art"],
    status: "published",
  },
  {
    id: "present-futures-rca",
    title: "Present Futures: Virtual and Augmented Reality in Art",
    description:
      "An RCA programme examining virtual reality and augmented reality within contemporary art practice.",
    url: "https://www.rca.ac.uk/study/programme-finder/present-futures-virtual-and-augmented-reality-in-art/",
    primaryGenre: "Education & Mentorship",
    tags: ["RCA", "Education", "Virtual Reality", "Augmented Reality"],
    status: "published",
  },
  {
    id: "museums-using-ar",
    title: "How Museums Are Using Augmented Reality",
    description:
      "Examples of museums using augmented reality for interpretation, engagement, and visitor experience.",
    url: "https://www.museumnext.com/article/how-museums-are-using-augmented-reality/",
    primaryGenre: "Museums & Culture",
    tags: ["Museums", "Augmented Reality", "Visitor Experience", "Case Study"],
    status: "published",
  },
  {
    id: "vr-art-exhibition-user-experience",
    title: "Investigating User Experience of VR Art Exhibitions",
    description:
      "An academic study examining how audiences experience virtual-reality art exhibitions.",
    url: "https://www.mdpi.com/2227-9709/11/2/30",
    primaryGenre: "Audience Insight",
    tags: ["Virtual Reality", "Art Exhibition", "User Experience", "Research"],
    status: "published",
  },
  {
    id: "frameless-whats-on",
    title: "What's On at FRAMELESS",
    description:
      "Current immersive art experiences and installations presented by FRAMELESS in London.",
    url: "https://frameless.com/whats-on/",
    primaryGenre: "Immersive Installation",
    tags: ["Immersive Exhibition", "Installation", "London", "Visual Reference"],
    status: "published",
  },
];

export const publicXRShowcaseItems = xrShowcaseItems.filter(
  (item) => item.status !== "missing-link" && Boolean(item.url),
);
