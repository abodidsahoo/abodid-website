import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Supabase integration-test environment is incomplete.");

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = null;
let projectId = null;
let uploadedAssetId = null;
let uploadedStoragePath = null;

const payload = (title, privateContext, media = null) => ({
  title,
  oneLineDescription: "Automated portfolio publishing verification.",
  context: privateContext,
  specificContribution: "Private contribution must not be returned in limited public mode.",
  yearStart: 2026,
  yearEnd: null,
  location: "Private location",
  duration: "Private duration",
  outcomeHeading: "Private outcome",
  outcomeText: "Private outcome text",
  workInProgress: true,
  limitedPublic: true,
  coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  coverAlt: "Laptop used for an automated portfolio test",
  coverFocalX: 50,
  coverFocalY: 50,
  seoTitle: "",
  metaDescription: "",
  socialImageUrl: "",
  searchVisible: false,
  blocks: media
    ? [{ id: crypto.randomUUID(), blockType: "single_image", content: { media }, settings: { width: "wide", spacing: "default", mediaFit: "cover" }, visible: true, position: 0 }]
    : [{ id: crypto.randomUUID(), blockType: "body_text", content: { text: "Private block text" }, settings: { width: "narrow", spacing: "default" }, visible: true, position: 0 }],
  taxonomies: [{ groupType: "primary", label: "Research", slug: "research" }],
  organisations: [],
  collaborators: [],
  links: [],
});

try {
  const email = `codex-portfolio-${Date.now()}@example.invalid`;
  const password = crypto.randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const profileUpdate = await service.from("profiles").update({ role: "admin" }).eq("id", userId).select("id");
  if (profileUpdate.error) throw profileUpdate.error;
  if (!profileUpdate.data?.length) {
    const profileInsert = await service.from("profiles").insert({ id: userId, username: `portfolio-test-${Date.now()}`, full_name: "Portfolio Integration Test", role: "admin" });
    if (profileInsert.error) throw profileInsert.error;
  }

  const adminClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await adminClient.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  const create = await adminClient.rpc("portfolio_create_project", { p_title: "Portfolio integration v1" });
  if (create.error) throw create.error;
  projectId = create.data;
  const projectResult = await service.from("portfolio_projects").select("*").eq("id", projectId).single();
  if (projectResult.error) throw projectResult.error;
  const slug = projectResult.data.slug;

  uploadedStoragePath = `${slug}/integration-${crypto.randomUUID()}.png`;
  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const upload = await adminClient.storage.from("portfolio-media").upload(uploadedStoragePath, onePixelPng, { contentType: "image/png" });
  if (upload.error) throw upload.error;
  const uploadedUrl = adminClient.storage.from("portfolio-media").getPublicUrl(uploadedStoragePath).data.publicUrl;
  const assetInsert = await adminClient.from("portfolio_media_assets").insert({
    project_id: projectId,
    storage_path: uploadedStoragePath,
    public_url: uploadedUrl,
    original_filename: "integration.png",
    mime_type: "image/png",
    file_size: onePixelPng.byteLength,
    width: 1,
    height: 1,
    alt_text: "Integration test pixel",
  }).select("*").single();
  if (assetInsert.error) throw assetInsert.error;
  uploadedAssetId = assetInsert.data.id;
  const uploadedMedia = { id: uploadedAssetId, url: uploadedUrl, storagePath: uploadedStoragePath, originalFilename: "integration.png", mimeType: "image/png", width: 1, height: 1, alt: "Integration test pixel" };

  const firstSave = await adminClient.rpc("portfolio_save_draft", { p_project_id: projectId, p_expected_lock_version: 0, p_payload: payload("Portfolio integration v1", "Private context v1", uploadedMedia) });
  if (firstSave.error) throw firstSave.error;
  assert.equal(firstSave.data, 1);
  const firstPublish = await adminClient.rpc("portfolio_publish_project", { p_project_id: projectId });
  if (firstPublish.error) throw firstPublish.error;
  const referencesAfterPublish = await adminClient.rpc("portfolio_media_reference_count", { p_asset_id: uploadedAssetId });
  if (referencesAfterPublish.error) throw referencesAfterPublish.error;
  assert.equal(referencesAfterPublish.data, 2);

  const firstPublic = await publicClient.from("portfolio_public_projects").select("*").eq("slug", slug).single();
  if (firstPublic.error) throw firstPublic.error;
  assert.equal(firstPublic.data.title, "Portfolio integration v1");
  assert.equal(firstPublic.data.context, "");
  assert.equal(firstPublic.data.blocks.length, 1);
  assert.equal(firstPublic.data.blocks[0].block_type, "single_image");
  assert.deepEqual(firstPublic.data.collaborators, []);
  assert.deepEqual(firstPublic.data.links, []);
  const directLimitedRevision = await publicClient.from("portfolio_project_revisions").select("id").eq("id", firstPublish.data);
  if (directLimitedRevision.error) throw directLimitedRevision.error;
  assert.equal(directLimitedRevision.data.length, 0);

  const secondSave = await adminClient.rpc("portfolio_save_draft", { p_project_id: projectId, p_expected_lock_version: 1, p_payload: payload("Portfolio integration v2", "Private context v2") });
  if (secondSave.error) throw secondSave.error;
  const referencesAfterDraftRemoval = await adminClient.rpc("portfolio_media_reference_count", { p_asset_id: uploadedAssetId });
  if (referencesAfterDraftRemoval.error) throw referencesAfterDraftRemoval.error;
  assert.equal(referencesAfterDraftRemoval.data, 1);
  const stillFirstPublic = await publicClient.from("portfolio_public_projects").select("title").eq("slug", slug).single();
  assert.equal(stillFirstPublic.data.title, "Portfolio integration v1");
  const staleSave = await adminClient.rpc("portfolio_save_draft", { p_project_id: projectId, p_expected_lock_version: 1, p_payload: payload("Stale overwrite", "Must fail") });
  assert.ok(staleSave.error?.message.includes("PORTFOLIO_CONFLICT"));

  const secondPublish = await adminClient.rpc("portfolio_publish_project", { p_project_id: projectId });
  if (secondPublish.error) throw secondPublish.error;
  const secondPublic = await publicClient.from("portfolio_public_projects").select("title").eq("slug", slug).single();
  assert.equal(secondPublic.data.title, "Portfolio integration v2");
  const history = await service.from("portfolio_project_revisions").select("id,title").eq("project_id", projectId).eq("state", "published").order("revision_number");
  assert.equal(history.data.length, 2);

  const restore = await adminClient.rpc("portfolio_restore_revision", { p_project_id: projectId, p_revision_id: firstPublish.data });
  if (restore.error) throw restore.error;
  const restoredDraft = await service.from("portfolio_project_revisions").select("title,state").eq("id", restore.data).single();
  assert.equal(restoredDraft.data.title, "Portfolio integration v1");
  assert.equal(restoredDraft.data.state, "draft");
  const liveAfterRestore = await publicClient.from("portfolio_public_projects").select("title").eq("slug", slug).single();
  assert.equal(liveAfterRestore.data.title, "Portfolio integration v2");

  console.log("Portfolio integration: create, autosave isolation, conflict, publish, limited RLS and restore passed.");
} finally {
  if (projectId) await service.from("portfolio_projects").delete().eq("id", projectId);
  if (uploadedStoragePath) await service.storage.from("portfolio-media").remove([uploadedStoragePath]);
  if (uploadedAssetId) await service.from("portfolio_media_assets").delete().eq("id", uploadedAssetId);
  if (userId) {
    await service.from("profiles").delete().eq("id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}
