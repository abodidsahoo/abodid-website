export type OutreachCategory =
  | "research"
  | "creative"
  | "founders"
  | "writing"
  | "curation"
  | "programmes";

export interface OutreachEmail {
  id: string;
  name: string;
  firstName: string;
  role: string;
  company: string;
  category: OutreachCategory;
  intro: string;
  body: string;
  cta: string;
}

export const outreachCategories: Array<{
  id: "all" | OutreachCategory;
  label: string;
  shortLabel: string;
  painPoint?: string;
}> = [
  { id: "all", label: "All recipients", shortLabel: "All" },
  {
    id: "research",
    label: "Researchers & PIs",
    shortLabel: "Research",
    painPoint: "Scattered literature, disconnected findings, and retrieval failure.",
  },
  {
    id: "creative",
    label: "Creative directors & filmmakers",
    shortLabel: "Creative",
    painPoint: "References and production assets living in five different places.",
  },
  {
    id: "founders",
    label: "Founders & executives",
    shortLabel: "Founders",
    painPoint: "Breakthrough ideas getting lost under cognitive overload.",
  },
  {
    id: "writing",
    label: "Authors & writers",
    shortLabel: "Writing",
    painPoint: "The blank-page problem and disconnected research archives.",
  },
  {
    id: "curation",
    label: "Archivists & curators",
    shortLabel: "Curation",
    painPoint: "Knowledge being stored carefully but remaining hard to retrieve.",
  },
  {
    id: "programmes",
    label: "Programme directors",
    shortLabel: "Programmes",
    painPoint: "Institutional memory scattered across teams and tools.",
  },
];

export const outreachEmails: OutreachEmail[] = [
  {
    id: "mark-elson",
    name: "Mark Elson",
    firstName: "Mark",
    role: "Principal Investigator",
    company: "Desert Archaeology Inc.",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for researchers and principal investigators.",
    body:
      "Running investigations at Desert Archaeology means your field notes, literature, and source connections are probably scattered across more places than you'd like. I help researchers build Obsidian systems that link citations, synthesis notes, and raw observations into one retrievable vault — so nothing gets buried when you need it most.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "josh-dasal",
    name: "Josh Dasal",
    firstName: "Josh",
    role: "Founder and Producer",
    company: "Kaboonki",
    category: "founders",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for founders and producers.",
    body:
      "Running Kaboonki means you're constantly juggling concepts, pitches, and production logistics — and the best ideas often disappear before they're captured properly. I help founders and producers build Obsidian systems that catch everything and surface it when it matters, so no breakthrough gets lost between projects.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "mark-collinson",
    name: "Mark Collinson",
    firstName: "Mark",
    role: "Book Author",
    company: "Book Writing Inc.",
    category: "writing",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for authors and writers.",
    body:
      "One of the hardest parts of writing a book isn't the writing — it's finding the right note at the right moment. I help authors build Obsidian systems that turn research archives, bookmarks, and spontaneous ideas into structured long-form work, so you're never staring at a blank page again.",
    cta: "Would you be up for a free 15-minute discovery call?",
  },
  {
    id: "thomas-kolicko",
    name: "Thomas Kolicko",
    firstName: "Thomas",
    role: "Executive Producer & Creative Director",
    company: "Traverse Cinema Studio",
    category: "creative",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for filmmakers and creative directors.",
    body:
      "Running Traverse Cinema Studio means your creative references, production logistics, and script notes are probably living in five different places. I help creative directors build interconnected Obsidian vaults where moodboards, characters, locations, and shoot logistics all talk to each other — so your vision stays intact from concept to wrap.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "monjori-mitra",
    name: "Monjori Mitra",
    firstName: "Monjori",
    role: "Founder & Research Director",
    company: "Medclin Research",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for founders and research directors.",
    body:
      "Leading Medclin Research means you're constantly synthesising literature, managing findings, and trying to connect dots across projects — often across tools that don't talk to each other. I help research directors build Obsidian systems that bring citations, notes, and insights into one structured, retrievable space so the thinking stays connected.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "faizal-zulkefli",
    name: "Faizal Zulkefli",
    firstName: "Faizal",
    role: "Programme Director",
    company: "Energy Research Institute @ NTU",
    category: "programmes",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for programme directors and research leaders.",
    body:
      "Directing a programme at NTU's Energy Research Institute means you're holding together research threads, stakeholder context, literature, and institutional memory — often across tools that weren't designed to work together. I help programme directors build Obsidian systems that make that complexity navigable and retrievable in one place.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "willow-goldstein",
    name: "Willow Goldstein",
    firstName: "Willow",
    role: "Founder and Creative Director",
    company: "The Bakery Atlanta",
    category: "creative",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for founders and creative directors.",
    body:
      "Running The Bakery Atlanta means your references, concepts, and client briefs are probably scattered across tools that don't talk to each other. I help creative directors build Obsidian systems where everything — inspiration, briefs, ideas — is connected and retrievable the moment you need it, without the friction of hunting across apps.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "will-lavery",
    name: "Will Lavery",
    firstName: "Will",
    role: "Principal Investigator",
    company: "Dr. Vince Clinical Research",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for researchers and principal investigators.",
    body:
      "Managing clinical investigations at Dr. Vince means you're constantly working across protocols, literature, and site-level findings that need to stay connected. I help principal investigators build Obsidian systems that link citations, notes, and observations into one coherent, searchable vault — so nothing slips through between sites or studies.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "jack-wells",
    name: "Jack Wells",
    firstName: "Jack",
    role: "Creative Director",
    company: "Writing Club",
    category: "creative",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for creative directors and writers.",
    body:
      "Leading Writing Club means you're sitting on a wealth of ideas, references, and half-formed concepts that rarely make it into the work at the right moment. I help creative directors build Obsidian vaults where everything is linked and surfaces when you need it — turning scattered thinking into structured creative output.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "jenine-stone",
    name: "Jenine Stone",
    firstName: "Jenine",
    role: "Principal Investigator",
    company: "Headlands Research - Escondido",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for researchers and principal investigators.",
    body:
      "Running investigations at Headlands Research means you're managing literature, site data, and synthesis notes that need to stay connected across a project's full lifecycle. I help principal investigators build Obsidian systems that make that knowledge retrievable and useful — not just stored — so the right insight is always one search away.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "rachel-warshaw",
    name: "Rachel Warshaw",
    firstName: "Rachel",
    role: "Research Director",
    company: "Hanover Research",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for research directors.",
    body:
      "Directing research at Hanover means you're constantly synthesising across projects, clients, and knowledge domains — and the institutional knowledge that holds it all together rarely lives in one place. I help research directors build Obsidian systems that bring all of that into one structured, connected vault so nothing slips through.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "sundar-p",
    name: "Sundar P",
    firstName: "Sundar",
    role: "CEO",
    company: "Google",
    category: "founders",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for CEOs and executive leaders.",
    body:
      "Operating at the scale you do means the volume of ideas, strategic context, and critical thinking you're holding is enormous — and most tools simply aren't built for that. I help leaders build personal Obsidian systems that capture and surface the right thinking at the right moment, without the cognitive overhead of managing it all manually.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "alexandra-wiktorek",
    name: "Alexandra Wiktorek",
    firstName: "Alexandra",
    role: "Research Director",
    company: "Hanover Research",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for research directors.",
    body:
      "Leading research at Hanover means you're constantly moving between projects, synthesising findings, and trying to hold institutional knowledge together across a distributed team. I help research directors build Obsidian systems that make that knowledge structured, connected, and retrievable — wherever you are when you need it.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "emily-renne",
    name: "Emily Renne",
    firstName: "Emily",
    role: "Research Director",
    company: "Hanover Research",
    category: "research",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for research directors.",
    body:
      "Directing research at Hanover means you're managing a lot of moving knowledge across clients and projects — and retrieval is often the hardest part. I help research directors build Obsidian systems where everything is connected and surfaces when it matters, so you spend less time searching and more time thinking.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "ela-boyd",
    name: "Ela Boyd",
    firstName: "Ela",
    role: "Founder & Curator",
    company: "Museum of Artificial Art",
    category: "curation",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for founders and curators.",
    body:
      "Founding and curating the Museum of Artificial Art means you're building a body of knowledge — artists, concepts, references, institutional context — that needs to be as interconnected as the work itself. I help curators build Obsidian systems that make that knowledge navigable and alive, not buried in folders that never get opened.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "julia-weber",
    name: "Julia Weber",
    firstName: "Julia",
    role: "Archivist",
    company: "HAI",
    category: "curation",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for archivists and knowledge professionals.",
    body:
      "Archival work at HAI builds enormous depth of knowledge that's often harder to retrieve than it should be. I help archivists build Obsidian systems where sources, connections, and context are structured for real retrieval — not just preservation — so the right thing surfaces exactly when you need it.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
  {
    id: "jess-bruzzaniti",
    name: "Jess Bruzzaniti",
    firstName: "Jess",
    role: "Assistant Curator",
    company: "Curatorial+Co.",
    category: "curation",
    intro:
      "I am Abodid, a creative technologist and researcher based in London, globally known for building smart note-taking and retrieval systems using Obsidian for curators and arts professionals.",
    body:
      "Curation at Curatorial+Co. involves building deep contextual knowledge — artists, themes, sources, institutional history — that's incredibly hard to organise in a way that's genuinely useful later. I help curators build Obsidian systems where sources, themes, and connections are structured for real retrieval, not just filed away and forgotten.",
    cta: "Would you be open to a free 15-minute discovery call?",
  },
];

export const signature = [
  "Best,",
  "Abodid",
  "Creative Technologist & Researcher based in London",
  "www.abodid.com/obsidian-tutoring",
].join("\n");

export function emailAsText(email: OutreachEmail) {
  return [
    `Hey ${email.firstName},`,
    email.intro,
    email.body,
    email.cta,
    signature,
  ].join("\n\n");
}
