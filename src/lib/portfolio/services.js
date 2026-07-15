import { supabase } from "../supabaseClient";
import { portfolioFallbackProjects } from "./fallback";
import { orderPortfolioRevisionHistory, slugify, toSavePayload } from "./schema";

const missingSchema = (error) => ["42P01", "PGRST205", "PGRST200"].includes(error?.code);
const cleanArray = (value) => Array.isArray(value) ? value : [];

const mapTaxonomy = (term = {}) => ({
  id: term.id,
  groupType: term.groupType || term.group_type || "theme",
  label: term.label || "",
  slug: term.slug || slugify(term.label || ""),
});

const mapOrganisation = (item = {}) => ({
  id: item.id || item.organisation_id || item.organisation?.id,
  name: item.name || item.organisation?.name || "",
  slug: item.slug || item.organisation?.slug || slugify(item.name || item.organisation?.name || ""),
  url: item.url || item.organisation?.url || "",
  relationshipLabel: item.relationshipLabel || item.relationship_label || "",
  displayOrder: item.displayOrder ?? item.display_order ?? 0,
});

const mapCollaborator = (item = {}) => ({
  id: item.id || item.collaborator_id || item.collaborator?.id,
  name: item.name || item.collaborator?.name || "",
  roleLabel: item.roleLabel || item.role_label || "",
  primaryUrl: item.primaryUrl || item.primary_url || item.collaborator?.primary_url || "",
  secondaryUrl: item.secondaryUrl || item.secondary_url || item.collaborator?.secondary_url || "",
  organisation: item.organisation || item.collaborator?.organisation || "",
  displayOrder: item.displayOrder ?? item.display_order ?? 0,
});

const mapLink = (item = {}) => ({
  id: item.id,
  linkType: item.linkType || item.link_type || "external",
  label: item.label || "",
  url: item.url || "",
  displayOrder: item.displayOrder ?? item.display_order ?? 0,
});

const mapBlock = (block = {}) => ({
  id: block.id,
  blockType: block.blockType || block.block_type,
  content: block.content || block.content_jsonb || {},
  settings: block.settings || block.settings_jsonb || {},
  visible: block.visible !== false,
  position: block.position || 0,
});

const hydrateMediaValue = (value, manifests) => {
  if (!value || typeof value !== "object") return value;
  const manifest = manifests.get(value.id || value.assetId);
  if (!manifest) return value;
  return {
    ...manifest,
    ...value,
    id: manifest.id,
    url: manifest.url || value.url,
    originalUrl: manifest.originalUrl || manifest.url || value.originalUrl || value.url,
    storagePath: manifest.storagePath || value.storagePath,
    variants: manifest.variants || value.variants || {},
    processingStatus: manifest.processingStatus || value.processingStatus,
  };
};

const hydrateBlock = (block, manifests) => {
  const mapped = mapBlock(block);
  const media = mapped.content?.media;
  if (!media) return mapped;
  return {
    ...mapped,
    content: {
      ...mapped.content,
      media: Array.isArray(media)
        ? media.map((item) => hydrateMediaValue(item, manifests))
        : hydrateMediaValue(media, manifests),
    },
  };
};

export function mapPublicProject(row = {}) {
  const mediaManifests = new Map(cleanArray(row.media_assets).filter(Boolean).map((asset) => [asset.id, asset]));
  if (row.cover_media?.id) mediaManifests.set(row.cover_media.id, row.cover_media);
  if (row.social_image_media?.id) mediaManifests.set(row.social_image_media.id, row.social_image_media);
  return {
    id: row.project_id || row.id,
    slug: row.slug,
    status: row.status,
    featuredOrder: row.featured_order ?? row.featuredOrder ?? 0,
    title: row.title || "Untitled project",
    oneLineDescription: row.one_line_description || row.oneLineDescription || "",
    context: row.context || "",
    specificContribution: row.specific_contribution || row.specificContribution || "",
    yearStart: row.year_start ?? row.yearStart ?? null,
    yearEnd: row.year_end ?? row.yearEnd ?? null,
    location: row.location || "",
    duration: row.duration || "",
    outcomeHeading: row.outcome_heading || row.outcomeHeading || "",
    outcomeText: row.outcome_text || row.outcomeText || "",
    workInProgress: row.work_in_progress ?? row.workInProgress ?? false,
    limitedPublic: row.limited_public ?? row.limitedPublic ?? false,
    coverUrl: row.cover_url || row.coverUrl || "",
    coverMedia: row.cover_media ? hydrateMediaValue(row.cover_media, mediaManifests) : null,
    coverAlt: row.cover_alt || row.coverAlt || "",
    coverFocalX: row.cover_focal_x ?? row.coverFocalX ?? 50,
    coverFocalY: row.cover_focal_y ?? row.coverFocalY ?? 50,
    seoTitle: row.seo_title || row.seoTitle || "",
    metaDescription: row.meta_description || row.metaDescription || "",
    socialImageUrl: row.social_image_url || row.socialImageUrl || "",
    socialImageMedia: row.social_image_media ? hydrateMediaValue(row.social_image_media, mediaManifests) : null,
    searchVisible: row.search_visible ?? row.searchVisible ?? true,
    layoutStyle: row.layout_style ?? row.layoutStyle ?? 1,
    revisionNumber: row.revision_number || row.revisionNumber || 1,
    taxonomies: cleanArray(row.taxonomies).map(mapTaxonomy),
    organisations: cleanArray(row.organisations).map(mapOrganisation),
    collaborators: cleanArray(row.collaborators).map(mapCollaborator),
    links: cleanArray(row.links).map(mapLink),
    blocks: cleanArray(row.blocks).map((block) => hydrateBlock(block, mediaManifests)).sort((a, b) => a.position - b.position),
  };
}

export async function getPublishedPortfolioIndex() {
  const { data, error } = await supabase
    .from("portfolio_public_index")
    .select("*")
    .order("featured_order", { ascending: true });

  if (error) {
    if (!missingSchema(error)) console.error("Portfolio index failed:", error.message);
    return portfolioFallbackProjects.map(mapPublicProject);
  }
  if (!data?.length) return portfolioFallbackProjects.map(mapPublicProject);
  return data.map(mapPublicProject);
}

export async function getPublishedPortfolioProject(slug) {
  const { data, error } = await supabase
    .from("portfolio_public_projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error && !missingSchema(error)) console.error(`Portfolio project ${slug} failed:`, error.message);
  if (data) return mapPublicProject(data);
  return portfolioFallbackProjects.map(mapPublicProject).find((project) => project.slug === slug) || null;
}

export async function getPortfolioSlugRedirect(slug) {
  const { data, error } = await supabase
    .from("portfolio_public_redirects")
    .select("slug")
    .eq("old_slug", slug)
    .maybeSingle();
  if (error) return null;
  return data?.slug || null;
}

export async function requirePortfolioAdmin() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error("ADMIN_AUTH_REQUIRED");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (error || profile?.role !== "admin") throw new Error("ADMIN_ACCESS_DENIED");
  return session;
}

export async function listAdminProjects() {
  await requirePortfolioAdmin();
  const { data: projects, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .order("featured_order", { ascending: true });
  if (error) throw error;
  const revisionIds = [...new Set((projects || []).flatMap((project) => [project.draft_revision_id, project.published_revision_id]).filter(Boolean))];
  let revisions = [];
  if (revisionIds.length) {
    const result = await supabase
      .from("portfolio_project_revisions")
      .select("id,title,one_line_description,cover_url,updated_at,published_at,work_in_progress,lock_version")
      .in("id", revisionIds);
    if (result.error) throw result.error;
    revisions = result.data || [];
  }
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const draftIds = (projects || []).map((project) => project.draft_revision_id).filter(Boolean);
  const searchByRevision = new Map(draftIds.map((id) => [id, []]));
  if (draftIds.length) {
    const [taxonomy, organisations, collaborators] = await Promise.all([
      supabase.from("portfolio_revision_taxonomy").select("revision_id,term:portfolio_taxonomy_terms(label)").in("revision_id", draftIds),
      supabase.from("portfolio_revision_organisations").select("revision_id,organisation:portfolio_organisations(name)").in("revision_id", draftIds),
      supabase.from("portfolio_revision_collaborators").select("revision_id,role_label,collaborator:portfolio_collaborators(name)").in("revision_id", draftIds),
    ]);
    const relationError = [taxonomy, organisations, collaborators].find((result) => result.error)?.error;
    if (relationError) throw relationError;
    (taxonomy.data || []).forEach((row) => searchByRevision.get(row.revision_id)?.push(row.term?.label));
    (organisations.data || []).forEach((row) => searchByRevision.get(row.revision_id)?.push(row.organisation?.name));
    (collaborators.data || []).forEach((row) => searchByRevision.get(row.revision_id)?.push(row.collaborator?.name, row.role_label));
  }
  return (projects || []).map((project) => ({
    ...project,
    draft: byId.get(project.draft_revision_id) || null,
    published: byId.get(project.published_revision_id) || null,
    searchText: (searchByRevision.get(project.draft_revision_id) || []).filter(Boolean).join(" "),
  }));
}

export async function createPortfolioProject(title) {
  await requirePortfolioAdmin();
  const { data, error } = await supabase.rpc("portfolio_create_project", {
    p_title: title?.trim() || "Untitled project",
  });
  if (error) throw error;
  return data;
}

export async function updatePortfolioProjectIdentity(projectId, patch) {
  await requirePortfolioAdmin();
  const values = {};
  if (patch.slug !== undefined) {
    const { error } = await supabase.rpc("portfolio_update_slug", { p_project_id: projectId, p_slug: slugify(patch.slug) });
    if (error) throw error;
  }
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.visibility !== undefined) values.visibility = patch.visibility;
  if (Object.keys(values).length) {
    const { error } = await supabase.from("portfolio_projects").update(values).eq("id", projectId);
    if (error) throw error;
  }
}

export async function loadAdminProject(projectId) {
  await requirePortfolioAdmin();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
  let projectResult = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq(isUuid ? "id" : "slug", projectId)
    .maybeSingle();
  if (!projectResult.data && !isUuid) {
    const redirect = await supabase
      .from("portfolio_slug_redirects")
      .select("project_id")
      .eq("old_slug", projectId)
      .maybeSingle();
    if (redirect.data?.project_id) {
      projectResult = await supabase.from("portfolio_projects").select("*").eq("id", redirect.data.project_id).maybeSingle();
    }
  }
  const { data: project, error: projectError } = projectResult;
  if (projectError) throw projectError;
  if (!project) throw new Error("PORTFOLIO_PROJECT_NOT_FOUND");
  const resolvedProjectId = project.id;

  const { data: revision, error: revisionError } = await supabase
    .from("portfolio_project_revisions")
    .select("*")
    .eq("id", project.draft_revision_id)
    .single();
  if (revisionError) throw revisionError;

  const [blocksResult, taxonomyResult, organisationsResult, collaboratorsResult, linksResult, historyResult] = await Promise.all([
    supabase.from("portfolio_project_blocks").select("*").eq("revision_id", revision.id).order("position"),
    supabase.from("portfolio_revision_taxonomy").select("*, term:portfolio_taxonomy_terms(*)").eq("revision_id", revision.id).order("display_order"),
    supabase.from("portfolio_revision_organisations").select("*, organisation:portfolio_organisations(*)").eq("revision_id", revision.id).order("display_order"),
    supabase.from("portfolio_revision_collaborators").select("*, collaborator:portfolio_collaborators(*)").eq("revision_id", revision.id).order("display_order"),
    supabase.from("portfolio_revision_links").select("*").eq("revision_id", revision.id).order("display_order"),
    supabase.from("portfolio_project_revisions").select("id,revision_number,title,state,published_at,created_at").eq("project_id", resolvedProjectId).in("state", ["published", "archived"]).not("published_at", "is", null).order("revision_number", { ascending: false }),
  ]);
  const resultError = [blocksResult, taxonomyResult, organisationsResult, collaboratorsResult, linksResult, historyResult].find((result) => result.error)?.error;
  if (resultError) throw resultError;

  const mediaIds = new Set([revision.cover_media_id, revision.social_image_media_id].filter(Boolean));
  for (const block of blocksResult.data || []) {
    const media = block.content_jsonb?.media;
    const items = Array.isArray(media) ? media : media ? [media] : [];
    items.forEach((item) => {
      const id = item?.id || item?.assetId;
      if (/^[0-9a-f-]{36}$/i.test(id || "")) mediaIds.add(id);
    });
  }
  let mediaManifests = new Map();
  if (mediaIds.size) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from("media_assets")
      .select("id,public_url,object_key,original_filename,mime_type,file_size,width,height,alt_text,caption,credit,processing_status,processing_error,created_at,media_variants(variant_key,target_width,actual_width,actual_height,public_url,file_size,mime_type)")
      .in("id", [...mediaIds]);
    if (mediaError) throw mediaError;
    mediaManifests = new Map((mediaRows || []).map((asset) => {
      const mapped = mapLibraryAsset(asset);
      return [mapped.id, mapped];
    }));
  }

  return {
    project,
    history: orderPortfolioRevisionHistory(historyResult.data || [], project.published_revision_id),
    draft: {
      id: revision.id,
      lockVersion: revision.lock_version,
      revisionNumber: revision.revision_number,
      title: revision.title || "",
      oneLineDescription: revision.one_line_description || "",
      context: revision.context || "",
      specificContribution: revision.specific_contribution || "",
      yearStart: revision.year_start,
      yearEnd: revision.year_end,
      location: revision.location || "",
      duration: revision.duration || "",
      outcomeHeading: revision.outcome_heading || "",
      outcomeText: revision.outcome_text || "",
      workInProgress: revision.work_in_progress,
      limitedPublic: revision.limited_public,
      coverUrl: revision.cover_url || "",
      coverMedia: revision.cover_media_id ? mediaManifests.get(revision.cover_media_id) || null : null,
      coverAlt: revision.cover_alt || "",
      coverFocalX: revision.cover_focal_x ?? 50,
      coverFocalY: revision.cover_focal_y ?? 50,
      seoTitle: revision.seo_title || "",
      metaDescription: revision.meta_description || "",
      socialImageUrl: revision.social_image_url || "",
      socialImageMedia: revision.social_image_media_id ? mediaManifests.get(revision.social_image_media_id) || null : null,
      searchVisible: revision.search_visible,
      layoutStyle: revision.layout_style || "default",
      blocks: (blocksResult.data || []).map((block) => hydrateBlock(block, mediaManifests)),
      taxonomies: (taxonomyResult.data || []).map((row) => mapTaxonomy(row.term)),
      organisations: (organisationsResult.data || []).map(mapOrganisation),
      collaborators: (collaboratorsResult.data || []).map(mapCollaborator),
      links: (linksResult.data || []).map(mapLink),
    },
  };
}

export async function savePortfolioDraft(projectId, draft) {
  await requirePortfolioAdmin();
  const { data, error } = await supabase.rpc("portfolio_save_draft", {
    p_project_id: projectId,
    p_expected_lock_version: draft.lockVersion,
    p_payload: toSavePayload(draft),
  });
  if (error) {
    if (String(error.message).includes("PORTFOLIO_CONFLICT")) {
      const conflict = new Error("PORTFOLIO_CONFLICT");
      conflict.code = "PORTFOLIO_CONFLICT";
      throw conflict;
    }
    throw error;
  }
  return data;
}

export async function publishPortfolioProject(projectId) {
  await requirePortfolioAdmin();
  const { data, error } = await supabase.rpc("portfolio_publish_project", { p_project_id: projectId });
  if (error) throw error;
  return data;
}

export async function restorePortfolioRevision(projectId, revisionId) {
  await requirePortfolioAdmin();
  const { data, error } = await supabase.rpc("portfolio_restore_revision", {
    p_project_id: projectId,
    p_revision_id: revisionId,
  });
  if (error) throw error;
  return data;
}

export async function reorderPortfolioProjects(ids) {
  await requirePortfolioAdmin();
  const { error } = await supabase.rpc("portfolio_reorder_projects", { p_project_ids: ids });
  if (error) throw error;
}

export async function archivePortfolioProject(projectId) {
  return updatePortfolioProjectIdentity(projectId, { status: "archived" });
}

const imageDimensions = (file) => new Promise((resolve) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  // Safety timeout: resolve with null dimensions if the browser never fires
  // onload or onerror (e.g. a locked file, weird MIME, or browser quirk).
  const fallback = setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    resolve({ width: null, height: null });
  }, 5000);
  image.onload = () => {
    clearTimeout(fallback);
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
    URL.revokeObjectURL(objectUrl);
  };
  image.onerror = () => {
    clearTimeout(fallback);
    resolve({ width: null, height: null });
    URL.revokeObjectURL(objectUrl);
  };
  image.src = objectUrl;
});

export async function uploadPortfolioImage(project, file, metadata = {}) {
  const session = await requirePortfolioAdmin();
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Images must be 20 MB or smaller.");
  const storageFolder = slugify(project.storage_folder || project.slug) || "project";
  const folder = `originals/${storageFolder}`;
  const dimensionsPromise = imageDimensions(file);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
  const presignResponse = await fetch("/api/admin/media/presign", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      folder,
    }),
  });
  const signed = await presignResponse.json().catch(() => ({}));
  if (!presignResponse.ok) throw new Error(signed.error || "Could not prepare the Cloudflare upload.");

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: signed.requiredHeaders,
    body: file,
  });
  if (!uploadResponse.ok) throw new Error(`Cloudflare rejected the image with status ${uploadResponse.status}.`);

  const dimensions = await dimensionsPromise;
  const completeResponse = await fetch("/api/admin/media/complete", {
    method: "POST",
    headers,
    body: JSON.stringify({
      objectKey: signed.objectKey,
      originalFilename: file.name,
      expectedSize: file.size,
      width: dimensions.width,
      height: dimensions.height,
      projectId: project.id,
    }),
  });
  const complete = await completeResponse.json().catch(() => ({}));
  if (!completeResponse.ok) throw new Error(complete.error || "Could not catalogue the Cloudflare upload.");
  return {
    ...complete.asset,
    id: complete.asset.id,
    url: complete.asset.publicUrl,
    originalUrl: complete.asset.publicUrl,
    storagePath: complete.asset.objectKey,
    alt: metadata.alt || "",
    caption: metadata.caption || "",
    credit: metadata.credit || "",
    focalX: 50,
    focalY: 50,
    variants: complete.asset.variants || {},
    processingStatus: complete.asset.processingStatus || "uploaded",
  };
}

export async function deletePortfolioImage(media) {
  const session = await requirePortfolioAdmin();
  if (!media?.id || !media?.storagePath) return { deleted: false, reason: "external" };
  const response = await fetch("/api/admin/media/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ assetId: media.id }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 409 && result.reason === "referenced") return result;
  if (!response.ok) throw new Error(result.error || "Could not delete the image.");
  return result;
}

const mapLibraryAsset = (asset) => ({
  id: asset.id,
  url: asset.public_url,
  originalUrl: asset.public_url,
  publicUrl: asset.public_url,
  storagePath: asset.object_key,
  objectKey: asset.object_key,
  originalFilename: asset.original_filename,
  mimeType: asset.mime_type,
  fileSize: asset.file_size,
  width: asset.width,
  height: asset.height,
  alt: asset.alt_text || "",
  caption: asset.caption || "",
  credit: asset.credit || "",
  focalX: 50,
  focalY: 50,
  processingStatus: asset.processing_status || "uploaded",
  processingError: asset.processing_error || null,
  variants: Object.fromEntries((asset.media_variants || []).map((variant) => [variant.variant_key, {
    key: variant.variant_key,
    url: variant.public_url,
    width: variant.actual_width,
    height: variant.actual_height,
    targetWidth: variant.target_width,
    fileSize: variant.file_size,
    mimeType: variant.mime_type,
  }])),
});

export async function searchPortfolioMediaAssets(search = "") {
  await requirePortfolioAdmin();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,public_url,object_key,original_filename,mime_type,file_size,width,height,alt_text,caption,credit,processing_status,processing_error,created_at,media_variants(variant_key,target_width,actual_width,actual_height,public_url,file_size,mime_type)")
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const needle = String(search || "").trim().toLowerCase();
  return (data || [])
    .filter((asset) => !needle || `${asset.original_filename} ${asset.object_key}`.toLowerCase().includes(needle))
    .map(mapLibraryAsset);
}
