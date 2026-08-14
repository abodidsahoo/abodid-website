import { readFile } from "node:fs/promises";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const DIGEST_DATE = "2026-08-14";
const FAILED_RUN_ID = "af2c6f5e-8a66-471c-b346-d8c1bcc2a857";
const RUN_KEY = `recovery:${DIGEST_DATE}:${FAILED_RUN_ID}`;
const IDEMPOTENCY_KEY = `reading-digest/${RUN_KEY}`;

const RECOVERED_READING = {
  url: "https://3rdspace3rdspace.substack.com/p/wtf-is-a-creative-technologist-by",
  canonical_url: "https://3rdspace3rdspace.substack.com/p/wtf-is-a-creative-technologist-by",
  title: "WTF is a Creative Technologist? by Tina Tarighian",
  source_name: "3rd Space",
  source_domain: "3rdspace3rdspace.substack.com",
  publication_date: "2026-07-07",
  estimated_reading_minutes: 10,
  why_it_matters:
    "Explores creative technology as a bridge between personal expression, emotional storytelling, and professional practice.",
  topic_names: ["Creative technology", "Art and work", "Personal practice"],
  relevance_score: 0.98,
  credibility_score: 0.9,
  rank_score: 17.56,
  is_foundational: false,
  verification_status: "verified",
  http_status: 200,
  content_type: "text/html; charset=utf-8",
  status: "discovered",
};

// Chosen from verified, unsent database readings after checking that each page
// still resolves and its title/content match the stored record.
const SUPPORTING_READING_IDS = [
  "de1b55cd-3dad-4cbb-8068-cae20ea04170",
  "0cd119b2-e2d2-4225-b7dd-5c2c1aed3712",
  "19440577-2e88-4c01-a6bb-13578053e558",
  "a3c7ce79-74fb-4a44-9f29-3b8189f0e2df",
];

const shouldSend = process.argv.includes("--send");

const requiredEnv = [
  "PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  ...(shouldSend ? ["RESEND_API_KEY"] : []),
];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const sharedSource = await readFile(
  new URL("../supabase/functions/_shared/reading-digest.ts", import.meta.url),
  "utf8",
);
const sharedJavaScript = ts.transpileModule(sharedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const shared = await import(
  `data:text/javascript;base64,${Buffer.from(sharedJavaScript).toString("base64")}`
);

const database = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const unwrap = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const settings = unwrap(
  await database
    .from("reading_digest_settings")
    .select("recipient_name,recipient_email,sender_name,sender_email,reply_to_email")
    .eq("id", true)
    .single(),
  "Load digest settings",
);

const supporting = unwrap(
  await database
    .from("reading_digest_readings")
    .select("*")
    .in("id", SUPPORTING_READING_IDS),
  "Load supporting readings",
);
const supportingById = new Map(supporting.map((reading) => [reading.id, reading]));
const orderedSupporting = SUPPORTING_READING_IDS.map((id) => supportingById.get(id));
if (orderedSupporting.some((reading) => !reading)) {
  throw new Error("One or more supporting readings no longer exist.");
}
for (const reading of orderedSupporting) {
  if (reading.verification_status !== "verified") {
    throw new Error(`${reading.title} is no longer verified.`);
  }
  if (!["discovered", "selected"].includes(reading.status)) {
    throw new Error(`${reading.title} is no longer available for delivery.`);
  }
}

const previewItems = [
  {
    ...RECOVERED_READING,
    normalized_title: shared.normalizeTitle(RECOVERED_READING.title),
  },
  ...orderedSupporting,
];

console.log(JSON.stringify({
  mode: shouldSend ? "send" : "preview",
  digestDate: DIGEST_DATE,
  recipient: settings.recipient_email.replace(/(^.).*(@.*$)/, "$1***$2"),
  subject: shared.digestSubject(settings.recipient_name, DIGEST_DATE),
  items: previewItems.map((item, index) => ({
    position: index + 1,
    title: item.title,
    domain: item.source_domain,
    url: item.url,
  })),
}, null, 2));

if (!shouldSend) process.exit(0);

let run = unwrap(
  await database
    .from("reading_digest_runs")
    .select("*")
    .eq("run_key", RUN_KEY)
    .maybeSingle(),
  "Find recovery run",
);

if (run?.status === "completed") {
  console.log(JSON.stringify({ alreadySent: true, runId: run.id }));
  process.exit(0);
}

if (!run) {
  run = unwrap(
    await database
      .from("reading_digest_runs")
      .insert({
        run_key: RUN_KEY,
        trigger_source: "manual",
        status: "running",
        discovered_count: 1,
        verified_count: 5,
        metadata: {
          recovery: true,
          recovered_from_run_id: FAILED_RUN_ID,
          recovered_from_error_prefix: true,
          note: "Recovered the preserved first result and filled the digest with four verified unsent readings without running discovery again.",
        },
      })
      .select("*")
      .single(),
    "Create recovery run",
  );
} else {
  unwrap(
    await database
      .from("reading_digest_runs")
      .update({ status: "running", finished_at: null, error_message: null })
      .eq("id", run.id),
    "Resume recovery run",
  );
}

let recoveredReading = unwrap(
  await database
    .from("reading_digest_readings")
    .select("*")
    .eq("canonical_url", RECOVERED_READING.canonical_url)
    .maybeSingle(),
  "Find recovered reading",
);

if (!recoveredReading) {
  recoveredReading = unwrap(
    await database
      .from("reading_digest_readings")
      .insert({
        ...RECOVERED_READING,
        normalized_title: shared.normalizeTitle(RECOVERED_READING.title),
        discovery_run_id: run.id,
        metadata: {
          recovery: true,
          recovered_from_run_id: FAILED_RUN_ID,
          recovered_from: "stored_error_prefix",
          verified_at: new Date().toISOString(),
        },
      })
      .select("*")
      .single(),
    "Store recovered reading",
  );
}

if (!["discovered", "selected"].includes(recoveredReading.status)) {
  throw new Error("The recovered reading has already been delivered or rejected.");
}

const items = [recoveredReading, ...orderedSupporting];
const subject = shared.digestSubject(settings.recipient_name, DIGEST_DATE);
const html = shared.renderDigestHtml({
  items,
  recipientName: settings.recipient_name,
  digestDate: DIGEST_DATE,
});

let delivery = unwrap(
  await database
    .from("reading_digest_deliveries")
    .select("*")
    .eq("run_id", run.id)
    .maybeSingle(),
  "Find recovery delivery",
);

if (delivery?.status === "sent") {
  console.log(JSON.stringify({ alreadySent: true, deliveryId: delivery.id }));
  process.exit(0);
}

if (!delivery) {
  delivery = unwrap(
    await database
      .from("reading_digest_deliveries")
      .insert({
        run_id: run.id,
        delivery_date: DIGEST_DATE,
        recipient_email: settings.recipient_email,
        subject,
        status: "preparing",
        idempotency_key: IDEMPOTENCY_KEY,
        html,
      })
      .select("*")
      .single(),
    "Create recovery delivery",
  );
} else {
  unwrap(
    await database
      .from("reading_digest_deliveries")
      .update({ subject, html, error_message: null })
      .eq("id", delivery.id),
    "Refresh recovery delivery",
  );
}

const existingItems = unwrap(
  await database
    .from("reading_digest_delivery_items")
    .select("reading_id,position,is_read_first")
    .eq("delivery_id", delivery.id),
  "Load recovery delivery items",
);

if (existingItems.length === 0) {
  unwrap(
    await database.from("reading_digest_delivery_items").insert(
      items.map((reading, index) => ({
        delivery_id: delivery.id,
        reading_id: reading.id,
        position: index + 1,
        is_read_first: index === 0,
      })),
    ),
    "Create recovery delivery items",
  );
} else {
  const expected = items.map((reading) => reading.id);
  const actual = [...existingItems]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.reading_id);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error("Existing recovery delivery items do not match this recovery set.");
  }
}

const now = new Date().toISOString();
unwrap(
  await database
    .from("reading_digest_readings")
    .update({ status: "selected", selected_at: now, updated_at: now })
    .in("id", items.map((reading) => reading.id)),
  "Reserve recovery readings",
);
unwrap(
  await database
    .from("reading_digest_deliveries")
    .update({ status: "sending", attempted_at: now, error_message: null })
    .eq("id", delivery.id),
  "Mark recovery delivery as sending",
);

let resendEmailId;
try {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": IDEMPOTENCY_KEY,
    },
    body: JSON.stringify({
      from: `${settings.sender_name} <${settings.sender_email}>`,
      to: [settings.recipient_email],
      subject,
      html,
      ...(settings.reply_to_email ? { reply_to: settings.reply_to_email } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.id) {
    throw new Error(
      `Resend failed (${response.status}): ${payload.message ?? payload.name ?? "unknown error"}`,
    );
  }
  resendEmailId = payload.id;

  unwrap(
    await database.rpc("reading_digest_finalize_delivery", {
      p_delivery_id: delivery.id,
      p_resend_email_id: resendEmailId,
    }),
    "Finalize recovery delivery",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await Promise.all([
    database
      .from("reading_digest_deliveries")
      .update({ status: "failed", error_message: message })
      .eq("id", delivery.id),
    database
      .from("reading_digest_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_message: message })
      .eq("id", run.id),
  ]);
  throw error;
}

const finalDelivery = unwrap(
  await database
    .from("reading_digest_deliveries")
    .select("id,status,sent_at,resend_email_id")
    .eq("id", delivery.id)
    .single(),
  "Verify recovery delivery",
);

console.log(JSON.stringify({
  sent: finalDelivery.status === "sent",
  runId: run.id,
  deliveryId: finalDelivery.id,
  resendEmailId: finalDelivery.resend_email_id,
  sentAt: finalDelivery.sent_at,
}, null, 2));
