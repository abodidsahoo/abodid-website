import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContactEmbeddingText,
  inferEmailType,
  normalizeLinkedInDate,
  normalizeLinkedInUrl,
  parseLinkedInConnectionsCsv,
  reconcileSourceDerivedFields,
  sourceRecordChanged,
} from "../../src/lib/network/csv.js";

test("parses LinkedIn preamble, quoted values, and preserves the source snapshot", () => {
  const csv = [
    "Notes:",
    "This file contains private connections.",
    "",
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
    '"Ada","Lovelace","https://www.linkedin.com/in/ada/?trk=export","ADA@example.com","Analytical, Engines","Researcher","25 Jul 2026"',
  ].join("\n");

  const result = parseLinkedInConnectionsCsv(csv);
  assert.equal(result.preambleRows, 3);
  assert.equal(result.totalRows, 1);
  assert.equal(result.validRows, 1);
  assert.equal(result.failedRows, 0);
  assert.equal(result.records[0].full_name, "Ada Lovelace");
  assert.equal(result.records[0].source_company, "Analytical, Engines");
  assert.equal(result.records[0].source_email, "ada@example.com");
  assert.equal(result.records[0].linkedin_url, "https://www.linkedin.com/in/ada");
  assert.equal(result.records[0].connected_on, "2026-07-25");
  assert.equal(result.records[0].import_snapshot.Company, "Analytical, Engines");
  assert.equal(result.records[0].newsletter_status, "not_subscribed");
});

test("reports identity-empty source rows without inventing contacts", () => {
  const csv = [
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
    ",,,,,,25 Jul 2026",
    "Grace,Hopper,https://linkedin.com/in/grace-hopper,,,,25 Jul 2026",
  ].join("\n");

  const result = parseLinkedInConnectionsCsv(csv);
  assert.equal(result.totalRows, 2);
  assert.equal(result.validRows, 1);
  assert.equal(result.failedRows, 1);
  assert.equal(result.errors[0].code, "missing_identity");
});

test("normalizes source identifiers and separates email type from consent", () => {
  assert.equal(
    normalizeLinkedInUrl("linkedin.com/in/Example/?trk=connections"),
    "https://www.linkedin.com/in/Example",
  );
  assert.equal(normalizeLinkedInDate("26 Jul 2026"), "2026-07-26");
  assert.equal(inferEmailType("person@gmail.com"), "personal");
  assert.equal(inferEmailType("person@company.example"), "work");
});

test("detects meaningful CSV-source changes without comparing manual fields", () => {
  const existing = {
    first_name: "Ada",
    last_name: "Lovelace",
    linkedin_url: "https://www.linkedin.com/in/ada",
    source_email: null,
    source_company: "Company A",
    source_position: "Researcher",
    connected_on: "2026-07-25",
    notes: "Manual note",
  };
  assert.equal(sourceRecordChanged(existing, { ...existing, notes: "Different note" }), false);
  assert.equal(sourceRecordChanged(existing, { ...existing, source_company: "Company B" }), true);
});

test("supports an explicit manual mapping for non-standard export headers", () => {
  const csv = [
    "Given,Surname,Profile,Mail,Organisation,Role,Since",
    "Ada,Lovelace,https://linkedin.com/in/ada,ADA@example.com,Analytical Engines,Researcher,01 Jan 2024",
  ].join("\n");
  const profile = parseLinkedInConnectionsCsv(csv, {
    columnMapping: {
      "First Name": "Given",
      "Last Name": "Surname",
      URL: "Profile",
      "Email Address": "Mail",
      Company: "Organisation",
      Position: "Role",
      "Connected On": "Since",
    },
  });

  assert.equal(profile.validRows, 1);
  assert.equal(profile.records[0].full_name, "Ada Lovelace");
  assert.equal(profile.records[0].email, "ada@example.com");
  assert.equal(profile.columnMapping.Company, "Organisation");
});

test("syncs source-derived values while preserving manual corrections as conflicts", () => {
  const timestamp = "2026-07-26T12:00:00.000Z";
  const updates = reconcileSourceDerivedFields({
    source_email: null,
    email: null,
    source_company: "Old Company",
    company: "Old Company",
    source_position: "Editor",
    position: "Editorial Director",
    work_categories: ["Film & Media"],
    incoming_conflicts: {},
  }, {
    source_email: "person@example.com",
    source_company: "New Museum",
    source_position: "Curator",
  }, timestamp);

  assert.equal(updates.email, "person@example.com");
  assert.equal(updates.email_type, "work");
  assert.equal(updates.company, "New Museum");
  assert.equal(updates.position, undefined);
  assert.deepEqual(updates.incoming_conflicts.source_position, {
    previousSource: "Editor",
    incoming: "Curator",
    current: "Editorial Director",
    detectedAt: timestamp,
  });
  assert.ok(updates.work_categories.includes("Culture"));
});

test("includes private relationship data in semantic embedding input", () => {
  const input = buildContactEmbeddingText({
    full_name: "Ada Lovelace",
    company: "Analytical Engines",
    position: "Editor",
    outreach_goals: ["Editorial collaborations"],
    tags: ["Publishing"],
    relationship_context: "Met through a design journal.",
    notes: "Interested in commissioning essays about creative technology.",
  });

  assert.match(input, /Editorial collaborations/);
  assert.match(input, /Met through a design journal/);
  assert.match(input, /commissioning essays about creative technology/);
});
