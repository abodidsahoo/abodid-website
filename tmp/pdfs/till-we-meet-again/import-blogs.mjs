import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: "/Users/abodid/Documents/GitHub/personal-site/.env" });

const pdfPath = "/Users/abodid/Downloads/Till_we_meet_again_useful_blog_series.pdf";
const commit = process.argv.includes("--commit");

const imageUrls = {
  22: "https://assets.abodid.com/photos/variants/uk-2026/1600/22_UK-Trip-2026-5beb156a70.webp",
  43: "https://assets.abodid.com/photos/variants/uk-2026/1600/43_UK-Trip-2026-1f7edf7fc3.webp",
  58: "https://assets.abodid.com/photos/variants/uk-2026/1600/58_UK-Trip-2026-31b90e14ef.webp",
  70: "https://assets.abodid.com/photos/variants/uk-2026/1600/70_UK-Trip-2026-64ef528472.webp",
  84: "https://assets.abodid.com/photos/variants/uk-2026/1600/84_UK-Trip-2026-2a3c278ce3.webp",
  117: "https://assets.abodid.com/photos/variants/uk-2026/1600/117_UK-Trip-2026-269bf13d5f.webp",
  126: "https://assets.abodid.com/photos/variants/uk-2026/1600/126_UK-Trip-2026-908854c136.webp",
  163: "https://assets.abodid.com/photos/variants/uk-2026/1600/163_UK-Trip-2026-47c650b5b7.webp",
  179: "https://assets.abodid.com/photos/variants/uk-2026/1600/179_UK-Trip-2026-6f7034f0b0.webp",
  188: "https://assets.abodid.com/photos/variants/uk-2026/1600/188_UK-Trip-2026-3d9270b276.webp",
  224: "https://assets.abodid.com/photos/variants/uk-2026/1600/224_UK-Trip-2026-ea57a8a8e8.webp",
  239: "https://assets.abodid.com/photos/variants/uk-2026/1600/239_UK-Trip-2026-ce55701865.webp",
  247: "https://assets.abodid.com/photos/variants/uk-2026/1600/247_UK-Trip-2026-75c6629727.webp",
  284: "https://assets.abodid.com/photos/variants/uk-2026/1600/284_UK-Trip-2026-27660523a4.webp",
  298: "https://assets.abodid.com/photos/variants/uk-2026/1600/298_UK-Trip-2026-c705f53f45.webp",
};

const definitions = [
  {
    title: "How I Got Into a Major Research Conference Without a PhD",
    slug: "how-i-got-into-a-major-research-conference-without-a-phd",
    pageRange: [3, 5],
    bodyStart: "This was not just another journey for me.",
    expectedWords: 1726,
    excerpt: "How two last-minute abstracts led to presenting and chairing at the British Sociological Association Annual Conference without a PhD.",
    categories: ["Journal", "Research", "Conferences"],
    tags: ["British Sociological Association", "Manchester", "Academic Conferences", "Autoethnography", "RCA", "Research"],
    cover: 58,
    inlineImages: [22, 43],
  },
  {
    title: "I Had Zero Savings. Here’s How I Funded a UK Research Trip",
    slug: "i-had-zero-savings-how-i-funded-a-uk-research-trip",
    pageRange: [6, 7],
    bodyStart: "I used ChatGPT to conduct a deep search",
    expectedWords: 1247,
    excerpt: "How a Cambridge bursary, a public sponsorship video, alumni support, and an arts foundation made a UK research trip possible.",
    categories: ["Journal", "Funding", "Research"],
    tags: ["Research Funding", "Cambridge", "Bursaries", "Sponsorship", "BSA", "Higher Education"],
    cover: 117,
    inlineImages: [70, 84],
  },
  {
    title: "How a LinkedIn Conversation Eventually Took Me to Cambridge",
    slug: "how-a-linkedin-conversation-eventually-took-me-to-cambridge",
    pageRange: [8, 10],
    bodyStart: "To give the backstory, I had reached out to her during my NID days.",
    expectedWords: 2088,
    excerpt: "Four years after a LinkedIn conversation, I finally met Professor Eleanor Dare and joined Cambridge’s Cultural Heritage Data School.",
    categories: ["Journal", "Cambridge", "Research"],
    tags: ["University of Cambridge", "Cultural Heritage Data", "LinkedIn", "Eleanor Dare", "Design Justice", "Data School"],
    cover: 179,
    inlineImages: [126, 163],
  },
  {
    title: "How I Took Odia Culture Abroad Through Brand Collaborations",
    slug: "how-i-took-odia-culture-abroad-through-brand-collaborations",
    pageRange: [12, 14],
    bodyStart: "I started reaching out to people and shared the news with them.",
    expectedWords: 1796,
    excerpt: "How collaborations with Odisha-based designers brought Sambalpuri, Kotpad, ikat, and Pattachitra traditions to Manchester and Cambridge.",
    categories: ["Journal", "Odia Culture", "Collaborations"],
    tags: ["Odisha", "Sambalpuri", "Kotpad", "Pattachitra", "Indian Textiles", "Brand Collaborations", "Cambridge"],
    cover: 239,
    inlineImages: [188, 224],
  },
  {
    title: "How We Did Manchester and Cambridge as a Couple on a Budget",
    slug: "how-we-did-manchester-and-cambridge-as-a-couple-on-a-budget",
    pageRange: [15, 17],
    bodyStart: "After having enough funds to make this trip happen, I quickly applied",
    expectedWords: 2062,
    excerpt: "A personal account of travelling through London, Manchester, and Cambridge as a couple while keeping accommodation, food, and transport affordable.",
    categories: ["Journal", "Travel", "Relationships"],
    tags: ["Manchester", "Cambridge", "London", "Budget Travel", "Couples Travel", "Airbnb", "Ramen"],
    cover: 298,
    inlineImages: [247, 284],
  },
];

const source = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
const pages = source.split("\f");

function reflowParagraph(chunk) {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((text, line) => {
      if (!text) return line;
      return text.endsWith("-") ? `${text}${line}` : `${text} ${line}`;
    }, "");
}

function endsSentence(text) {
  return /[.!?][”’"')\]]?$/.test(text.trim());
}

function extractParagraphs({ pageRange, bodyStart }) {
  const paragraphs = [];
  for (let pageNumber = pageRange[0]; pageNumber <= pageRange[1]; pageNumber += 1) {
    let page = pages[pageNumber - 1] || "";
    page = page
      .split(/\r?\n/)
      .filter((line) => !/^\s*\d+\s*$/.test(line))
      .join("\n")
      .trim();

    if (pageNumber === pageRange[0]) {
      const start = page.indexOf(bodyStart);
      if (start < 0) throw new Error(`Could not find body start on page ${pageNumber}: ${bodyStart}`);
      page = page.slice(start);
    }

    const pageParagraphs = page
      .split(/\n\s*\n+/)
      .map(reflowParagraph)
      .filter(Boolean);

    if (paragraphs.length && pageParagraphs.length && !endsSentence(paragraphs.at(-1))) {
      paragraphs[paragraphs.length - 1] = `${paragraphs.at(-1)} ${pageParagraphs.shift()}`;
    }
    paragraphs.push(...pageParagraphs);
  }
  return paragraphs;
}

function makeImageBlock(imageNumber) {
  return {
    id: crypto.randomUUID(),
    blockType: "single_image",
    content: {
      media: {
        url: imageUrls[imageNumber],
        alt: `Temporary photograph from the UK 2026 trip (image ${imageNumber})`,
        caption: "",
      },
    },
    settings: { width: "standard", spacing: "default" },
  };
}

function makeBlocks(paragraphs, inlineImages) {
  const insertionPoints = new Map([
    [Math.max(1, Math.floor(paragraphs.length / 3)), inlineImages[0]],
    [Math.max(2, Math.floor((paragraphs.length * 2) / 3)), inlineImages[1]],
  ]);
  const blocks = [];
  paragraphs.forEach((text, index) => {
    blocks.push({
      id: crypto.randomUUID(),
      blockType: "body_text",
      content: { text },
      settings: { width: "standard", spacing: "default" },
    });
    const imageNumber = insertionPoints.get(index + 1);
    if (imageNumber) blocks.push(makeImageBlock(imageNumber));
  });
  return blocks;
}

function compileMarkdown(blocks) {
  return blocks
    .map((block) => {
      if (block.blockType === "body_text") return block.content.text;
      if (block.blockType === "single_image") {
        return `![${block.content.media.alt}](${block.content.media.url})`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

const prepared = definitions.map((definition, index) => {
  const paragraphs = extractParagraphs(definition);
  const blocks = makeBlocks(paragraphs, definition.inlineImages);
  const wordCount = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  const delta = wordCount - definition.expectedWords;
  if (Math.abs(delta) > 20) {
    throw new Error(`${definition.title}: extracted word count ${wordCount}, expected about ${definition.expectedWords}`);
  }
  return {
    title: definition.title,
    slug: definition.slug,
    excerpt: definition.excerpt,
    meta_description: definition.excerpt,
    category: definition.categories,
    tags: definition.tags,
    cover_image: imageUrls[definition.cover],
    content: compileMarkdown(blocks),
    blocks,
    published: false,
    sort_order: index,
    _audit: {
      wordCount,
      expectedWords: definition.expectedWords,
      paragraphCount: paragraphs.length,
      blockCount: blocks.length,
      images: [definition.cover, ...definition.inlineImages],
      first: paragraphs[0],
      last: paragraphs.at(-1),
    },
  };
});

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Missing Supabase configuration");
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const slugs = prepared.map((post) => post.slug);
const { data: collisions, error: collisionError } = await supabase
  .from("blog")
  .select("id,title,slug,published")
  .in("slug", slugs);
if (collisionError) throw collisionError;
if (collisions?.length) {
  throw new Error(`Refusing to overwrite existing posts: ${collisions.map((post) => post.slug).join(", ")}`);
}

const { data: lastOrdered, error: orderError } = await supabase
  .from("blog")
  .select("sort_order")
  .order("sort_order", { ascending: false })
  .limit(1);
if (orderError) throw orderError;
const firstSortOrder = Number(lastOrdered?.[0]?.sort_order ?? -1) + 1;

const rows = prepared.map(({ _audit, ...post }, index) => ({
  ...post,
  sort_order: firstSortOrder + index,
}));

if (!commit) {
  console.log(JSON.stringify({ mode: "dry-run", firstSortOrder, posts: prepared.map((post) => ({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    categories: post.category,
    tags: post.tags,
    cover: post.cover_image,
    audit: post._audit,
  })) }, null, 2));
  process.exit(0);
}

const { data: inserted, error: insertError } = await supabase
  .from("blog")
  .insert(rows)
  .select("id,title,slug,published,sort_order");
if (insertError) throw insertError;

console.log(JSON.stringify({ mode: "committed", inserted }, null, 2));
