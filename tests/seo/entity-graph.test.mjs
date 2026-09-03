import test from "node:test";
import assert from "node:assert/strict";
import {
  seoIdentity,
  personJsonLd,
  videoObjectJsonLd,
  curatedResearchPaperJsonLd,
  vaultNoteJsonLd,
  creativeWorkJsonLd,
  breadcrumbJsonLd,
} from "../../src/lib/seoData.js";

test("entity-graph: canonical Person ID is consistent across all definitions", () => {
  const CANONICAL_PERSON_ID = "https://abodid.com/#abodid-sahoo";
  assert.equal(seoIdentity.personId, CANONICAL_PERSON_ID);

  const person = personJsonLd();
  assert.equal(person["@id"], CANONICAL_PERSON_ID);
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, "Abodid Sahoo");
});

test("entity-graph: videoObjectJsonLd references canonical person ID and valid properties", () => {
  const video = videoObjectJsonLd({
    title: "Shadows in Motion",
    description: "A short documentary film.",
    url: "https://abodid.com/films/shadows-in-motion",
    thumbnailUrl: "https://abodid.com/images/shadows.jpg",
    contentUrl: "https://youtube.com/watch?v=12345",
    embedUrl: "https://www.youtube-nocookie.com/embed/12345",
    uploadDate: "2025-06-01T00:00:00Z",
    categories: ["Documentary", "Experimental"],
    roles: ["Director", "Editor"],
  });

  assert.equal(video["@type"], "VideoObject");
  assert.equal(video.name, "Shadows in Motion");
  assert.equal(video.author["@id"], seoIdentity.personId);
  assert.equal(video.creator["@id"], seoIdentity.personId);
  assert.equal(video.uploadDate, "2025-06-01T00:00:00Z");
  assert.deepEqual(video.genre, ["Documentary", "Experimental"]);
  assert.deepEqual(video.keywords, ["Director", "Editor"]);
});

test("entity-graph: curatedResearchPaperJsonLd strictly avoids claiming authorship for Abodid", () => {
  const paper = curatedResearchPaperJsonLd({
    title: "Autoethnography and Affect in Visual Media",
    description: "An inquiry into memory and subjective documentation.",
    url: "https://abodid.com/research-papers/autoethnography-and-affect",
    pdfUrl: "https://example.org/paper.pdf",
    publishedDate: "2024-11-10T00:00:00Z",
    authors: ["Dr. Sarah Jenkins", "Prof. Alan Turing"],
    tags: ["autoethnography", "affect", "memory"],
  });

  assert.equal(paper["@type"], "ScholarlyArticle");
  assert.equal(paper.headline, "Autoethnography and Affect in Visual Media");

  // Authors MUST be the original researchers
  assert.ok(Array.isArray(paper.author));
  assert.equal(paper.author.length, 2);
  assert.equal(paper.author[0].name, "Dr. Sarah Jenkins");
  assert.equal(paper.author[1].name, "Prof. Alan Turing");

  // Abodid must NEVER be listed as author
  const authorNames = paper.author.map((a) => a.name);
  assert.ok(!authorNames.includes("Abodid Sahoo"));

  // Abodid must be credited as editor / curator / maintainer
  assert.equal(paper.editor["@id"], seoIdentity.personId);
  assert.equal(paper.maintainer["@id"], seoIdentity.personId);
  assert.equal(paper.isPartOf.curator["@id"], seoIdentity.personId);
  assert.equal(paper.isPartOf.url, "https://abodid.com/research-papers");
});

test("entity-graph: vaultNoteJsonLd associates notes with canonical author and vault collection", () => {
  const note = vaultNoteJsonLd({
    title: "Second Brain Architecture",
    description: "Principles for maintaining interconnected personal knowledge.",
    url: "https://abodid.com/research/obsidian-vault/second-brain-architecture",
    dateModified: "2026-08-20T10:00:00Z",
  });

  assert.equal(note["@type"], "Article");
  assert.equal(note.headline, "Second Brain Architecture");
  assert.equal(note.author["@id"], seoIdentity.personId);
  assert.equal(note.dateModified, "2026-08-20T10:00:00Z");
  assert.equal(note.isPartOf["@type"], "Collection");
  assert.equal(note.isPartOf.url, "https://abodid.com/research/obsidian-vault");
});

test("entity-graph: creativeWorkJsonLd associates projects with canonical creator", () => {
  const work = creativeWorkJsonLd({
    title: "Spatial Audio Interface",
    description: "Interactive sound design and web audio experimentation.",
    url: "https://abodid.com/work/spatial-audio-interface",
    image: "https://abodid.com/images/audio.jpg",
    dateCreated: "2025",
    keywords: ["Web Audio", "Three.js"],
  });

  assert.equal(work["@type"], "CreativeWork");
  assert.equal(work.name, "Spatial Audio Interface");
  assert.equal(work.creator["@id"], seoIdentity.personId);
  assert.deepEqual(work.keywords, ["Web Audio", "Three.js"]);
});

test("entity-graph: breadcrumbJsonLd formats valid ordered list items", () => {
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Films", path: "/films" },
    { name: "The Sculptor", path: "/films/the-sculptor" },
  ]);

  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.equal(breadcrumb.itemListElement.length, 3);
  assert.equal(breadcrumb.itemListElement[0].position, 1);
  assert.equal(breadcrumb.itemListElement[0].name, "Home");
  assert.equal(breadcrumb.itemListElement[0].item, "https://abodid.com/");
  assert.equal(breadcrumb.itemListElement[2].position, 3);
  assert.equal(breadcrumb.itemListElement[2].name, "The Sculptor");
  assert.equal(breadcrumb.itemListElement[2].item, "https://abodid.com/films/the-sculptor");
});
