import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
} from "../../../../lib/network/api";
import {
  errorsToCsv,
  inspectLinkedInConnectionsCsv,
  LINKEDIN_CONNECTION_COLUMNS,
  parseLinkedInConnectionsCsv,
  reconcileSourceDerivedFields,
  sourceRecordChanged,
} from "../../../../lib/network/csv.js";

export const prerender = false;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const DATABASE_BATCH_SIZE = 400;
const PAGE_SIZE = 1000;

const chunk = <T>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const readUpload = async (request: Request) => {
  const formData = await request.formData();
  const mode = formData.get("mode") === "commit" ? "commit" : "preview";
  const mappingValue = formData.get("mapping");
  let columnMapping: Record<string, string> = {};
  if (typeof mappingValue === "string" && mappingValue.trim()) {
    try {
      const parsed = JSON.parse(mappingValue);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        columnMapping = Object.fromEntries(
          LINKEDIN_CONNECTION_COLUMNS
            .map((column) => [column, String(parsed[column] || "").trim()])
            .filter(([, sourceColumn]) => sourceColumn),
        );
      }
    } catch {
      throw new Error("The manual column mapping is invalid.");
    }
  }
  const file = formData.get("file");
  if (!file || typeof file !== "object" || typeof (file as File).text !== "function") {
    throw new Error("Choose a Connections.csv file.");
  }
  const upload = file as File;
  if (upload.size > MAX_FILE_BYTES) {
    throw new Error("The CSV is larger than the 12 MB private import limit.");
  }
  if (!/\.csv$/i.test(upload.name)) {
    throw new Error("The import must be a .csv file.");
  }
  return {
    mode,
    upload,
    columnMapping,
    text: await upload.text(),
  };
};

const previewPayload = (profile: any) => ({
  sourceSha256: profile.sourceSha256,
  preambleRows: profile.preambleRows,
  detectedColumns: profile.detectedColumns,
  totalRows: profile.totalRows,
  validRows: profile.validRows,
  failedRows: profile.failedRows,
  duplicateCount: profile.duplicateCount,
  blankCounts: profile.blankCounts,
  errorPreview: profile.errors.slice(0, 30),
});

const loadExistingSourceRecords = async (supabase: any, ownerId: string) => {
  const records: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("network_contacts")
      .select([
        "id", "source_record_key", "first_name", "last_name", "linkedin_url",
        "source_email", "source_company", "source_position", "connected_on",
        "email", "company", "position", "work_categories", "incoming_conflicts",
      ].join(","))
      .eq("owner_id", ownerId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
  }
};

const upsertBatches = async (
  supabase: any,
  rows: Record<string, unknown>[],
) => {
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

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  let upload;
  try {
    upload = await readUpload(request);
  } catch (error) {
    return networkJson({
      error: error instanceof Error ? error.message : "Could not read the CSV.",
    }, 400);
  }

  let profile;
  try {
    profile = parseLinkedInConnectionsCsv(upload.text, {
      columnMapping: upload.columnMapping,
    });
  } catch (error) {
    if (upload.mode === "preview") {
      const inspection = inspectLinkedInConnectionsCsv(
        upload.text,
        Object.values(upload.columnMapping),
      );
      if (inspection.detectedColumns.length) {
        return networkJson({
          error: error instanceof Error ? error.message : "Map the source columns to continue.",
          mappingRequired: true,
          expectedColumns: LINKEDIN_CONNECTION_COLUMNS,
          ...inspection,
        }, 422);
      }
    }
    return networkJson({
      error: error instanceof Error ? error.message : "The CSV could not be parsed.",
    }, 400);
  }

  if (upload.mode === "preview") {
    return networkJson({ preview: previewPayload(profile) });
  }

  const startedAt = new Date().toISOString();
  const { data: importRun, error: importRunError } = await supabase
    .from("network_import_runs")
    .insert({
      owner_id: user.id,
      source_filename: upload.upload.name,
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

  if (importRunError || !importRun) {
    console.error("[network] Could not create import audit:", importRunError?.message);
    return networkJson({
      error: /network_import_runs/i.test(importRunError?.message || "")
        ? "Network Intelligence has not been provisioned in Supabase yet."
        : "Could not begin the private import.",
      setupRequired: /network_import_runs/i.test(importRunError?.message || ""),
    }, 503);
  }

  try {
    const existingRows = await loadExistingSourceRecords(supabase, user.id);
    const existingByKey = new Map(
      existingRows.map((record) => [record.source_record_key, record]),
    );
    const insertedRows: Record<string, unknown>[] = [];
    const existingUpserts: Record<string, unknown>[] = [];
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const record of profile.records || []) {
      const existing = existingByKey.get(record.source_record_key);
      const sourcePayload = {
        owner_id: user.id,
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

      if (existing) {
        if (sourceRecordChanged(existing, record)) updatedCount += 1;
        else unchangedCount += 1;
        existingUpserts.push({
          ...sourcePayload,
          ...reconcileSourceDerivedFields(existing, record, startedAt),
        });
      } else {
        insertedRows.push({
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

    await upsertBatches(supabase, insertedRows);
    await upsertBatches(supabase, existingUpserts);

    const { error: absentError } = await supabase
      .from("network_contacts")
      .update({ present_in_latest_export: false })
      .eq("owner_id", user.id)
      .lt("last_seen_in_export", startedAt)
      .eq("present_in_latest_export", true);
    if (absentError) throw absentError;

    const completedAt = new Date().toISOString();
    const report = {
      total: profile.totalRows,
      inserted: insertedRows.length,
      updated: updatedCount,
      unchanged: unchangedCount,
      duplicates: profile.duplicateCount,
      failed: profile.failedRows,
      pendingEmbeddings: insertedRows.length + updatedCount,
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
        completed_at: completedAt,
      })
      .eq("owner_id", user.id)
      .eq("id", importRun.id);
    if (completionError) throw completionError;

    return networkJson({
      report,
      completedAt,
      errors: profile.errors,
      errorCsv: profile.errors.length ? errorsToCsv(profile.errors) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The import failed.";
    console.error("[network] Import failed:", message);
    await supabase
      .from("network_import_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: [
          ...profile.errors.slice(0, 199),
          { code: "import_failure", message },
        ],
      })
      .eq("owner_id", user.id)
      .eq("id", importRun.id);
    return networkJson({
      error: "The import stopped before the latest-export marker was updated.",
      detail: message,
    }, 500);
  }
};
