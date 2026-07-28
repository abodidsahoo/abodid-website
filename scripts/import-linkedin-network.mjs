#!/usr/bin/env node
import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  buildContactEmbeddingText,
  parseLinkedInConnectionsCsv,
  reconcileSourceDerivedFields,
  sourceRecordChanged,
} from "../src/lib/network/csv.js";
import { createNetworkEmbedding } from "../src/lib/network/openrouter.js";

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const embedOnly = args.includes("--embed-only");
const embed = args.includes("--embed") || embedOnly;
const ownerIdArg = args.find((arg) => arg.startsWith("--owner-id="))?.split("=")[1];
const DATABASE_BATCH_SIZE = 400;
const EMBEDDING_BATCH_SIZE = Math.min(
  256,
  Math.max(1, Number.parseInt(process.env.OPENROUTER_NETWORK_BATCH_SIZE || "64", 10)),
);
const EMBEDDING_DELAY_MS = Math.max(
  0,
  Number.parseInt(process.env.OPENROUTER_NETWORK_BATCH_DELAY_MS || "120", 10),
);

if (!filePath) {
  throw new Error(
    "Usage: node scripts/import-linkedin-network.mjs /absolute/path/Connections.csv [--dry-run] [--embed|--embed-only] [--owner-id=<uuid>]",
  );
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const chunk = (items, size) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const resolveOwnerId = async () => {
  if (ownerIdArg) return ownerIdArg;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(2);
  if (error) throw error;
  if (data?.length !== 1) {
    throw new Error(
      `Expected exactly one admin owner but found ${data?.length || 0}. Pass --owner-id explicitly.`,
    );
  }
  return data[0].id;
};

const loadExisting = async (ownerId) => {
  const records = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("network_contacts")
      .select([
        "id", "source_record_key", "first_name", "last_name", "linkedin_url",
        "source_email", "source_company", "source_position", "connected_on",
        "email", "company", "position", "work_categories", "incoming_conflicts",
      ].join(","))
      .eq("owner_id", ownerId)
      .range(offset, offset + 999);
    if (error) throw error;
    records.push(...(data || []));
    if ((data || []).length < 1000) return records;
  }
};

const upsertRows = async (rows) => {
  for (const batch of chunk(rows, DATABASE_BATCH_SIZE)) {
    const { error } = await supabase
      .from("network_contacts")
      .upsert(batch, {
        onConflict: "owner_id,source_record_key",
        ignoreDuplicates: false,
      });
    if (error) throw error;
  }
};

const buildSemanticIndex = async (ownerId) => {
  const model = process.env.OPENROUTER_NETWORK_EMBEDDING_MODEL
    || process.env.OPENROUTER_EMBEDDING_MODEL
    || "openai/text-embedding-3-small";
  let processedTotal = 0;

  for (;;) {
    const { data: contacts, error } = await supabase
      .from("network_contacts")
      .select([
        "id", "full_name", "source_company", "source_position", "company", "position",
        "city", "region", "country", "work_categories", "expertise_keywords", "tags",
        "relationship_context", "public_summary",
      ].join(","))
      .eq("owner_id", ownerId)
      .eq("archived", false)
      .eq("embedding_refresh_needed", true)
      .order("updated_at", { ascending: true })
      .limit(EMBEDDING_BATCH_SIZE);
    if (error) throw error;
    if (!contacts?.length) break;

    const inputs = contacts.map(buildContactEmbeddingText);
    const embeddings = await createNetworkEmbedding(inputs, { model });
    const updates = contacts.map((contact, index) => ({
      id: contact.id,
      embedding: embeddings[index],
      model,
      hash: crypto.createHash("sha256").update(inputs[index]).digest("hex"),
    }));

    const { error: updateError } = await supabase.rpc(
      "update_network_contact_embeddings",
      {
        p_owner_id: ownerId,
        p_rows: updates,
      },
    );
    if (updateError) throw updateError;
    processedTotal += contacts.length;
    console.log(`[network-import] Semantic index: ${processedTotal.toLocaleString()} processed`);
    if (EMBEDDING_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, EMBEDDING_DELAY_MS));
    }
  }

  return processedTotal;
};

const csvText = await fs.readFile(filePath, "utf8");
const profile = parseLinkedInConnectionsCsv(csvText);
console.log(JSON.stringify({
  source: path.basename(filePath),
  total: profile.totalRows,
  valid: profile.validRows,
  failed: profile.failedRows,
  duplicates: profile.duplicateCount,
  dryRun,
  embed,
}, null, 2));

if (dryRun) process.exit(0);

const ownerId = await resolveOwnerId();
if (embedOnly) {
  const embedded = await buildSemanticIndex(ownerId);
  console.log(`[network-import] Semantic index complete: ${embedded.toLocaleString()} contacts`);
  process.exit(0);
}

const startedAt = new Date().toISOString();
const { data: importRun, error: importRunError } = await supabase
  .from("network_import_runs")
  .insert({
    owner_id: ownerId,
    source_filename: path.basename(filePath),
    source_sha256: profile.sourceSha256,
    status: "processing",
    total_rows: profile.totalRows,
    duplicate_count: profile.duplicateCount,
    failed_count: profile.failedRows,
    error_summary: profile.errors.slice(0, 200),
    started_at: startedAt,
  })
  .select("id")
  .single();
if (importRunError) throw importRunError;

try {
  const existing = await loadExisting(ownerId);
  const existingByKey = new Map(existing.map((record) => [record.source_record_key, record]));
  const inserts = [];
  const updates = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const record of profile.records) {
    const previous = existingByKey.get(record.source_record_key);
    const sourcePayload = {
      owner_id: ownerId,
      source_record_key: record.source_record_key,
      first_name: record.first_name,
      last_name: record.last_name,
      full_name: record.full_name,
      linkedin_url: record.linkedin_url,
      source_email: record.source_email,
      source_company: record.source_company,
      source_position: record.source_position,
      connected_on: record.connected_on,
      import_snapshot: record.import_snapshot,
      last_seen_in_export: startedAt,
      present_in_latest_export: true,
    };
    if (previous) {
      if (sourceRecordChanged(previous, record)) updatedCount += 1;
      else unchangedCount += 1;
      updates.push({
        ...sourcePayload,
        ...reconcileSourceDerivedFields(previous, record, startedAt),
      });
    } else {
      inserts.push({
        ...sourcePayload,
        imported_at: startedAt,
        email: record.email,
        company: record.company,
        position: record.position,
        work_categories: record.work_categories,
        confidence: record.confidence,
        has_email: record.has_email,
        email_type: record.email_type,
        newsletter_status: "not_subscribed",
        do_not_contact: false,
      });
    }
  }

  await upsertRows(inserts);
  await upsertRows(updates);
  const { error: absentError } = await supabase
    .from("network_contacts")
    .update({ present_in_latest_export: false })
    .eq("owner_id", ownerId)
    .lt("last_seen_in_export", startedAt)
    .eq("present_in_latest_export", true);
  if (absentError) throw absentError;

  const report = {
    inserted: inserts.length,
    updated: updatedCount,
    unchanged: unchangedCount,
    failed: profile.failedRows,
    duplicates: profile.duplicateCount,
  };
  const { error: completionError } = await supabase
    .from("network_import_runs")
    .update({
      status: "completed",
      inserted_count: report.inserted,
      updated_count: report.updated,
      unchanged_count: report.unchanged,
      duplicate_count: report.duplicates,
      failed_count: report.failed,
      completed_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("id", importRun.id);
  if (completionError) throw completionError;

  console.log("[network-import] Contact sync complete", report);
  if (embed) {
    const embedded = await buildSemanticIndex(ownerId);
    console.log(`[network-import] Semantic index complete: ${embedded.toLocaleString()} contacts`);
  }
} catch (error) {
  await supabase
    .from("network_import_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_summary: [
        ...profile.errors.slice(0, 199),
        { code: "import_failure", message: error instanceof Error ? error.message : String(error) },
      ],
    })
    .eq("owner_id", ownerId)
    .eq("id", importRun.id);
  throw error;
}
