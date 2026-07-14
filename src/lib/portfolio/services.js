import { supabase } from "../supabaseClient";
import { portfolioFallbackProjects } from "./fallback";
import { makeStorageFilename, orderPortfolioRevisionHistory, slugify, toSavePayload } from "./schema";

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

export function mapPublicProject(row = {}) {
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
    coverAlt: row.cover_alt || row.coverAlt || "",
    coverFocalX: row.cover_focal_x ?? row.coverFocalX ?? 50,
    coverFocalY: row.cover_focal_y ?? row.coverFocalY ?? 50,
    seoTitle: row.seo_title || row.seoTitle || "",
    metaDescription: row.meta_description || row.metaDescription || "",
    socialImageUrl: row.social_image_url || row.socialImageUrl || "",
    searchVisible: row.search_visible ?? row.searchVisible ?? true,
    layoutStyle: row.layout_style ?? row.layoutStyle ?? 1,
    revisionNumber: row.revision_number || row.revisionNumber || 1,
    taxonomies: cleanArray(row.taxonomies).map(mapTaxonomy),
    organisations: cleanArray(row.organisations).map(mapOrganisation),
    collaborators: cleanArray(row.collaborators).map(mapCollaborator),
    links: cleanArray(row.links).map(mapLink),
    blocks: cleanArray(row.blocks).map(mapBlock).sort((a, b) => a.position - b.position),
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
      coverAlt: revision.cover_alt || "",
      coverFocalX: revision.cover_focal_x ?? 50,
      coverFocalY: revision.cover_focal_y ?? 50,
      seoTitle: revision.seo_title || "",
      metaDescription: revision.meta_description || "",
      socialImageUrl: revision.social_image_url || "",
      searchVisible: revision.search_visible,
      layoutStyle: revision.layout_style || "default",
      blocks: (blocksResult.data || []).map(mapBlock),
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
  await requirePortfolioAdmin();
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Images must be 20 MB or smaller.");
  const folder = slugify(project.storage_folder || project.slug).split("-").slice(0, 5).join("-") || "project";
  const filename = makeStorageFilename(file.name);
  const storagePath = `${folder}/${filename}`;
  const { error: uploadError } = await supabase.storage.from("portfolio-media").upload(storagePath, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from("portfolio-media").getPublicUrl(storagePath);
  const dimensions = await imageDimensions(file);
  const { data, error } = await supabase.from("portfolio_media_assets").insert({
    project_id: project.id,
    storage_path: storagePath,
    public_url: publicData.publicUrl,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    width: dimensions.width,
    height: dimensions.height,
    alt_text: metadata.alt || "",
    caption: metadata.caption || "",
    credit: metadata.credit || "",
  }).select("*").single();
  if (error) throw error;
  return {
    id: data.id,
    url: data.public_url,
    storagePath: data.storage_path,
    originalFilename: data.original_filename,
    mimeType: data.mime_type,
    width: data.width,
    height: data.height,
    alt: data.alt_text || "",
    caption: data.caption || "",
    credit: data.credit || "",
    focalX: data.focal_x ?? 50,
    focalY: data.focal_y ?? 50,
  };
}

export async function deletePortfolioImage(media) {
  await requirePortfolioAdmin();
  if (!media?.id || !media?.storagePath) return { deleted: false, reason: "external" };
  const { data: referenceCount, error: referenceError } = await supabase.rpc("portfolio_media_reference_count", {
    p_asset_id: media.id,
  });
  if (referenceError) throw referenceError;
  if (Number(referenceCount) > 0) return { deleted: false, reason: "referenced", referenceCount: Number(referenceCount) };

  const { error: storageError } = await supabase.storage.from("portfolio-media").remove([media.storagePath]);
  if (storageError) throw storageError;
  const { error: metadataError } = await supabase.from("portfolio_media_assets").delete().eq("id", media.id);
  if (metadataError) throw metadataError;
  return { deleted: true, reason: "removed" };
}
