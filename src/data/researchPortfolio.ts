export type ResearchImage = {
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
};

export type ResearchReading = {
  badge?: string;
  title: string;
  description: string;
  href: string;
  thumbnail: string;
  buttonText?: string;
};

export type ResearchProject = {
  slug: string;
  title: string;
  role: string;
  premise: string;
  themes: string[];
  metaLabel: string;
  metaValue: string;
  intro: string;
  deeperHeading: string;
  deeper: string;
  process?: string[];
  outcome: string;
  outcomeBadge?: string;
  galleryLayout?: "split-3" | "split-3-right" | "hero-2" | "duo" | "single";
  images: ResearchImage[];
  related?: { label: string; href: string };
  reading?: ResearchReading;
  accent: "lime" | "pink" | "yellow" | "cyan" | "orange" | "purple";
};

const asset = (key: string) => `https://assets.abodid.com/${key}`;

// Content and image-source references: Abodid Research Page Final Content Blueprint,
// September 2026.
export const researchProjects: ResearchProject[] = [
  {
    slug: "cloud-memories-algorithmic-recall",
    title: "Cloud Memories and Algorithmic Recall",
    role: "Researcher / Visual Autoethnographer",
    premise:
      "How photographic excess, cloud platforms and AI sorting reshape memory, care, ownership and consent.",
    themes: ["Personal archives", "Platform surveillance", "AI ethics"],
    metaLabel: "Outcome",
    metaValue: "BSA 2026 poster",
    intro:
      "What happens when we make more photographs than we can live with - when most frames feel futile, yet a few matter intensely?",
    deeperHeading: "From storage to stewardship",
    deeper:
      "This study examines how photographic excess, cloud platforms and AI sorting shape memory, care and ownership. Working from a long-running personal archive of more than 180,000 images, I analyse selected photographs across time and place and co-view phone and iCloud archives with others to understand what people keep, delete, hide or share. Images, metadata and platform resurfacing events - such as Memories, face clustering and search prompts - become material for understanding how platforms participate in remembering. The recurring patterns include overwhelm from volume, a small number of anchor images that carry disproportionate meaning, algorithmic resurfacing that edits what feels salient, and uncertainty around consent once photographs circulate through backups, shared albums and AI-indexed faces.",
    outcome:
      "Accepted as a poster in the Science, Technology & Digital Studies stream at the British Sociological Association Annual Conference 2026. A related 2025 installation, “I thought I will forget you that night”, materialised more than 80,000 iCloud images as a one-metre-square archive.",
    outcomeBadge: "Accepted poster · Science, Technology & Digital Studies",
    galleryLayout: "hero-2",
    images: [
      {
        src: "https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg",
        alt: "Visual study of digital archives and algorithmic recall from the Punctum research series",
        caption:
          "Visual study of photographic excess, digital archives and algorithmic recall.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-rca-project-icloud-image-cluster-05153ef77c.webp"),
        alt: "A dense cluster of photographs from Abodid's iCloud archive",
        caption: "A visual study of photographic excess and algorithmic recall.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-rca-project-icloud-images-01-bd5533f069.webp"),
        alt: "Archival prints from the iCloud archive",
        caption: "Archival evidence from over 80,000 materialised iCloud photographs.",
      },
    ],
    related: { label: "Related work: I thought I will forget you that night", href: "/work" },
    accent: "lime",
  },
  {
    slug: "do-ghosts-feel-jealous",
    title: "Do ghosts feel jealous if you miss the living ones more than them?",
    role: "Artist-researcher / Photographer / Writer",
    premise:
      "An ongoing autoethnographic inquiry into unrequited love, sibling loss, absence and unresolved grief.",
    themes: ["Autoethnography", "Grief", "Phototherapy"],
    metaLabel: "Status",
    metaValue: "Ongoing research",
    intro:
      "A long-form inquiry into the dissonance between absence and presence: how love, loss and heartbreak remain inside photographs, bodies, rituals and everyday gestures.",
    deeperHeading: "Memory as research material",
    deeper:
      "The project grew from my experiences of losing my younger brother and later living through unrequited love. Using photographs from personal archives, prints, audio stories, video, performance, handwritten texts and conversations, I began treating memory not only as subject matter but as research material. The work asks whether we ever move on from loss, or whether earlier grief quietly reorganises the way we experience later relationships.",
    process: [
      "Archive-led image making with family photographs, screenshots, voice notes and personal visual material.",
      "Phototherapy and writing on images to make imagined conversations and unfinished goodbyes visible.",
      "Participatory responses, music and other associations as secondary research material.",
      "Performance and installation through large prints, projection, CRT video, audio and tactile elements.",
      "Consent, trigger warnings and careful handling of private conversations as part of the method.",
    ],
    outcome:
      "The project was conceived toward an exhibition and film, and continues to evolve into sociological research. Its later academic framing became “Rejection Re-Activates Unresolved Grief”, presented at BSA 2026.",
    galleryLayout: "hero-2",
    images: [
      {
        src: "/images/research-portfolio/ghosts-cover.jpg",
        alt: "Project cover showing a family photograph and the title Do ghosts feel jealous",
        caption: "Project cover from the ongoing RCA research corpus.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-rca-project-performance-01-85bda7535b.webp"),
        alt: "Performance image from the ongoing grief research project",
        caption: "Performance became a way to give absence a physical form.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-rca-project-wall-writing-01-216dec68db.webp"),
        alt: "Handwritten research material installed on a wall",
        caption: "Handwritten image-text and spatial studies from the research process.",
      },
    ],
    related: {
      label: "Academic finding: Rejection Re-Activates Unresolved Grief",
      href: "/research/rejection-reactivates-unresolved-grief",
    },
    accent: "pink",
  },
  {
    slug: "rejection-reactivates-unresolved-grief",
    title: "Rejection Re-Activates Unresolved Grief",
    role: "Researcher / Autoethnographer",
    premise:
      "A sociological framing of how romantic rejection can reactivate earlier grief when mourning remains unfinished.",
    themes: ["Unresolved grief", "Romantic rejection", "Family"],
    metaLabel: "Outcome",
    metaValue: "BSA 2026 roundtable",
    intro:
      "This research begins with a specific question: what happens when a romantic refusal reopens an older grief that was never fully worked through?",
    deeperHeading: "An archive-led autoethnography",
    deeper:
      "Originating in a case where romantic rejection reopened the pain of a sibling's death, the project treats unrequited love and unresolved bereavement as entangled rather than separate experiences. I write on archival family photographs as if in conversation with my younger brother, whose funeral I could not attend, and use those handwritten image-texts alongside extensive conversations about love and loss as ethnographic material. The analysis looks for recurring patterns around recalling, interrupted mourning and feelings of abandonment where ritual was absent. Intimate image-making and held dialogue can make coexisting losses legible without flattening their differences, while consent, anonymisation and the right to withdraw remain central to the method.",
    outcome:
      "Accepted as a roundtable presentation in the Families & Relationships stream at the British Sociological Association Annual Conference 2026. This paper is the academic research output of a larger ongoing artistic inquiry.",
    outcomeBadge: "Accepted roundtable · Families & Relationships",
    galleryLayout: "split-3-right",
    images: [
      {
        src: "/images/research-portfolio/rejection-responses.jpg",
        alt: "Participatory written responses displayed beside an outdoor installation",
        caption: "Participatory responses from the broader “Do ghosts...” research corpus.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-rca-project-wall-writing-02-494e1e4295.webp"),
        alt: "Handwritten research material installed on a gallery wall",
        caption: "Handwritten image-text and spatial studies documenting dialogue and grief.",
      },
      {
        src: "/images/research-portfolio/bsa-invitation.jpg",
        alt: "British Sociological Association invitation letter accepting two projects",
        caption: "Documentary proof of acceptance to the BSA Annual Conference 2026.",
      },
    ],
    related: {
      label: "Part of the ongoing Do ghosts... research corpus",
      href: "/research/do-ghosts-feel-jealous",
    },
    accent: "purple",
  },
  {
    slug: "cambridge-cultural-heritage-data-school",
    title: "Cultural Heritage Data School, Cambridge",
    role: "Bursary participant / Researcher",
    premise:
      "A methods-led research experience across cultural heritage data, co-design, photogrammetry and critical visualisation.",
    themes: ["Cultural heritage", "Co-design", "Data ethics"],
    metaLabel: "Year",
    metaValue: "2026",
    intro:
      "A week of methods for asking what cultural data becomes when it is handled through code, images, movement, participation and design.",
    deeperHeading: "Methods carried forward",
    deeper:
      "At the Cultural Heritage Data School run by Cambridge Digital Humanities, I worked across practical and critical approaches to cultural heritage data. Sessions moved between paper and Python, world-building, photogrammetry, hybrid walking methods, critical data visualisation and cultural probes. The experience was less about adopting technology for its own sake and more about asking what forms of knowledge are produced - and who is represented or flattened - when heritage is translated into data.",
    process: [
      "Photogrammetry with Polycam, reconnecting to earlier engineering experiments with Agisoft PhotoScan.",
      "Co-design and walking as research methods rather than only facilitation techniques.",
      "Critical data visualisation, including the ethics of scale, units and framing.",
      "Cultural probes and participatory methods for situated qualitative responses.",
    ],
    outcome:
      "Full bursary / funded participation in the 2026 Cultural Heritage Data School; our group developed and presented a participatory cultural-preservation activity to an international cohort of more than 50 fellows from over 15 countries.",
    galleryLayout: "hero-2",
    images: [
      {
        src: asset("photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp"),
        alt: "Participants collaborating at the Cultural Heritage Data School",
        caption: "A participatory co-design activity at Cambridge Digital Humanities.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-06-530ae313ad.webp"),
        alt: "A classroom session at the Cultural Heritage Data School",
        caption: "Methods moved between paper, code, images and group discussion.",
      },
      {
        src: asset("photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-photo-5daaec7b0a.webp"),
        alt: "Cultural Heritage Data School cohort group photograph",
        caption: "The 2026 international cohort at Cambridge.",
      },
    ],
    related: { label: "Read the complete UK 2026 memoir", href: "/uk2026" },
    accent: "cyan",
  },
  {
    slug: "cries-of-an-unmarried-widow",
    title: "Cries of an Unmarried Widow",
    role: "Artist-researcher / Photographer / Writer",
    premise:
      "A conceptual photography and writing project about grief without the social legitimacy of marriage.",
    themes: ["Widowhood", "Desire", "Unrecognised grief"],
    metaLabel: "Year",
    metaValue: "2025",
    intro:
      "What happens when a woman loses a partner without the social legitimacy of marriage - when her grief remains unrecognised, but her desire is still judged?",
    deeperHeading: "Grief outside recognised structures",
    deeper:
      "This conceptual photography and writing project is grounded in the experience of loving after loss, where the presence of a past lover continues to intrude upon moments of intimacy. Pleasure and guilt are not opposites here but coexisting states. At its core, the work reflects on the cultural construction of grief in South Asian contexts, where womanhood is often defined through relational identities such as marriage and widowhood. A married widow is socially named and visibly positioned through the loss of a husband; an unmarried woman who loses a partner may have no equivalent public identity for her grief. The work stays with that contradiction: memory can remain bodily and intimate even when society offers no language, ritual or status through which to hold it.",
    outcome:
      "A conceptual photographic body of work accompanied by long-form writing, presented here as a text-image research project rather than a conventional photography gallery.",
    galleryLayout: "split-3",
    images: [
      {
        src: "/images/research-portfolio/cries-cover.jpg",
        alt: "Cries of an Unmarried Widow book beside flowers and a cup",
        caption: "The project book and primary research cover.",
      },
      {
        src: asset("photos/variants/cries-of-an-unmarried-widow/1600/_N5A1669-dd03e060a3.webp"),
        alt: "Conceptual photograph from Cries of an Unmarried Widow",
        caption: "Desire, guilt and memory coexist inside the photographic series.",
      },
      {
        src: asset("photos/variants/cries-of-an-unmarried-widow/1600/_N5A1635-543d6bc52d.webp"),
        alt: "Photographic study of intimacy and touch",
        caption: "Tactile performance and intimate image-making as research method.",
      },
    ],
    related: {
      label: "View the complete photographic series",
      href: "/photography/cries-of-an-unmarried-widow",
    },
    reading: {
      badge: "Work in Progress",
      title: "Cries of an Unmarried Widow",
      description:
        "An intimate reading excerpt from my upcoming memoir tracing love, rejection, grief, and healing.",
      thumbnail: "/images/research-portfolio/cries-cover.jpg",
      href: "/blog/cries-of-an-unmarried-widow-book-excerpt",
      buttonText: "Read the Prelude",
    },
    accent: "orange",
  },
  {
    slug: "photogrammetry-physical-evidence",
    title: "Using Photogrammetry to Reconstruct Landscapes",
    role: "Researcher / Technical experimenter",
    premise:
      "An early technical study using drone imagery and photogrammetric workflows to reconstruct physical spaces and orthophotos.",
    themes: ["Photogrammetry", "3D reconstruction", "Aerial imaging"],
    metaLabel: "Context",
    metaValue: "Engineering-era study",
    intro:
      "An early experiment in reconstructing physical spaces from captured image and video data.",
    deeperHeading: "A technical origin point",
    deeper:
      "The study used aerial image acquisition and photogrammetric processing to turn overlapping visual data into measurable spatial outputs. The original workflow mapped image acquisition through preprocessing, image orientation, feature extraction and matching, DSM extraction, multi-image matching, filtering and solid true orthophoto production. A DJI Phantom 4 formed part of the acquisition setup. Years later, the method resurfaced at the Cambridge Cultural Heritage Data School: an earlier Agisoft PhotoScan workflow gave way to Polycam on an iPhone, connecting the technical language of engineering with later cultural-heritage and visual-research practice.",
    outcome:
      "A technical research poster and workflow study, presented as an origin point for the spatial and computational strand of the research practice.",
    galleryLayout: "single",
    images: [
      {
        src: "/images/research-portfolio/photogrammetry-poster.jpg",
        alt: "Photogrammetry research poster showing drone acquisition and orthophoto workflow",
        caption: "Original workflow poster: image acquisition to orthophoto production.",
      },
    ],
    related: {
      label: "Then / now: Cultural Heritage Data School, Cambridge",
      href: "/research/cambridge-cultural-heritage-data-school",
    },
    accent: "yellow",
  },
];

export const researchProjectBySlug = Object.fromEntries(
  researchProjects.map((project) => [project.slug, project]),
) as Record<string, ResearchProject>;
