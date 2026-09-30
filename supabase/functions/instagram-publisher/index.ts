import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.112.0";

type SocialPost = {
  id: string;
  media_ids: string[];
  media_order: string[];
  caption: string;
  hashtags: string;
  status: string;
  publish_state: Record<string, unknown> | null;
};

type MediaAsset = {
  id: string;
  public_url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  media_variants?: Array<{
    variant_key: string;
    public_url: string;
  }>;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Instagram publishing is not configured: missing ${name}.`);
  return value;
};

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const authorize = async (request: Request, database: SupabaseClient) => {
  const cronSecret = request.headers.get("x-cron-secret")?.trim() || "";
  if (cronSecret) {
    const { data } = await database
      .from("social_publisher_config")
      .select("cron_secret_hash")
      .eq("id", true)
      .maybeSingle();
    const suppliedHash = await sha256(cronSecret);
    if (data?.cron_secret_hash && timingSafeEqual(suppliedHash, data.cron_secret_hash)) {
      return { ok: true as const, source: "cron" as const };
    }
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return { ok: false as const };

  const { data: authData, error: authError } = await database.auth.getUser(token);
  if (authError || !authData.user) return { ok: false as const };
  const { data: profile } = await database
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  return profile?.role === "admin"
    ? { ok: true as const, source: "admin" as const }
    : { ok: false as const };
};

const graphConfig = () => ({
  accessToken: requiredEnv("INSTAGRAM_ACCESS_TOKEN"),
  userId: requiredEnv("INSTAGRAM_USER_ID"),
  version: Deno.env.get("INSTAGRAM_GRAPH_API_VERSION")?.trim() || "v24.0",
  baseUrl: (Deno.env.get("INSTAGRAM_GRAPH_BASE_URL")?.trim() ||
    "https://graph.instagram.com").replace(/\/$/, ""),
});

const graphRequest = async (
  path: string,
  options: { method?: "GET" | "POST"; params?: Record<string, string> } = {},
) => {
  const config = graphConfig();
  const method = options.method || "GET";
  const params = new URLSearchParams({
    ...(options.params || {}),
    access_token: config.accessToken,
  });
  const url = `${config.baseUrl}/${config.version}/${path.replace(/^\//, "")}`;
  const response = await fetch(method === "GET" ? `${url}?${params}` : url, {
    method,
    headers: method === "POST"
      ? { "Content-Type": "application/x-www-form-urlencoded" }
      : undefined,
    body: method === "POST" ? params : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `Meta request failed (${response.status}).`;
    const code = payload?.error?.code ? ` [${payload.error.code}]` : "";
    throw new Error(`${message}${code}`);
  }
  return payload as Record<string, unknown>;
};

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForContainer = async (containerId: string) => {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const payload = await graphRequest(containerId, {
      params: { fields: "status_code,status" },
    });
    const status = String(payload.status_code || "").toUpperCase();
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (["ERROR", "EXPIRED"].includes(status)) {
      throw new Error(String(payload.status || `Instagram container ${status.toLowerCase()}.`));
    }
    await delay(2000);
  }
  throw new Error("Instagram is still processing the media. Retry in a moment; the same container will be reused.");
};

const composeCaption = (caption: string, hashtags: string) => {
  const hashtagBlock = hashtags.trim();
  if (!hashtagBlock) return caption;
  if (!caption) return hashtagBlock;
  return `${caption}\n\n${hashtagBlock}`;
};

const validatePost = (post: SocialPost) => {
  if (!Array.isArray(post.media_order) || post.media_order.length < 1) {
    throw new Error("Choose at least one photograph.");
  }
  if (post.media_order.length > 10) {
    throw new Error("Instagram posts can contain at most 10 photographs.");
  }
  const combinedCaption = composeCaption(post.caption || "", post.hashtags || "");
  if (combinedCaption.length > 2200) {
    throw new Error("Caption and hashtags together exceed Instagram’s 2,200 character limit.");
  }
  const hashtagCount = Array.from(
    (post.hashtags || "").matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu),
  ).length;
  if (hashtagCount > 30) throw new Error("Instagram allows up to 30 hashtags.");
};

const resolveMedia = async (database: SupabaseClient, post: SocialPost) => {
  const { data, error } = await database
    .from("media_assets")
    .select("id,public_url,mime_type,width,height,media_variants(variant_key,public_url)")
    .in("id", post.media_order);
  if (error) throw error;

  const assets = (data || []) as unknown as MediaAsset[];
  const byId = new Map<string, MediaAsset>(assets.map((asset) => [asset.id, asset]));
  return post.media_order.map((id) => {
    const asset = byId.get(id);
    if (!asset || !/^(image\/jpeg|image\/jpg|video\/mp4)$/i.test(asset.mime_type || "")) {
      throw new Error("A selected Media Library item is no longer available or is not Instagram-ready.");
    }
    const isVideo = asset.mime_type.toLowerCase() === "video/mp4";
    if (!isVideo && asset.width && asset.height) {
      const ratio = asset.width / asset.height;
      if (ratio < 0.8 || ratio > 1.91) {
        throw new Error("A selected photograph is outside Instagram’s supported 4:5 to 1.91:1 aspect ratio.");
      }
    }
    // Browsing uses the fast 1600px WebP variant. Meta publishing receives
    // the public JPEG original because the Content Publishing API requires JPEG.
    const url = asset.public_url;
    if (!url || !/^https:\/\//i.test(url)) {
      throw new Error("Instagram requires every selected photograph to have a public HTTPS URL.");
    }
    return { id, url, kind: isVideo ? "video" as const : "image" as const };
  });
};

const updatePublishState = async (
  database: SupabaseClient,
  postId: string,
  state: Record<string, unknown>,
  containerId?: string,
) => {
  const { error } = await database
    .from("social_posts")
    .update({
      publish_state: state,
      ...(containerId ? { instagram_container_id: containerId } : {}),
    })
    .eq("id", postId)
    .eq("status", "publishing");
  if (error) throw error;
};

const publishPost = async (database: SupabaseClient, post: SocialPost) => {
  validatePost(post);
  const media = await resolveMedia(database, post);
  const config = graphConfig();
  const caption = composeCaption(post.caption || "", post.hashtags || "");
  const state = { ...(post.publish_state || {}) } as {
    childContainerIds?: string[];
    containerId?: string;
  };

  if (!state.containerId) {
    if (media.length === 1) {
      const created = await graphRequest(`${config.userId}/media`, {
        method: "POST",
        params: media[0].kind === "video"
          ? { media_type: "REELS", video_url: media[0].url, caption, share_to_feed: "true" }
          : { image_url: media[0].url, caption },
      });
      state.containerId = String(created.id || "");
      if (!state.containerId) throw new Error("Meta did not return a creation container id.");
      await updatePublishState(database, post.id, state, state.containerId);
    } else {
      const children = [...(state.childContainerIds || [])];
      for (let index = children.length; index < media.length; index += 1) {
        const created = await graphRequest(`${config.userId}/media`, {
          method: "POST",
          params: media[index].kind === "video"
            ? { media_type: "VIDEO", video_url: media[index].url, is_carousel_item: "true" }
            : { image_url: media[index].url, is_carousel_item: "true" },
        });
        const childId = String(created.id || "");
        if (!childId) throw new Error("Meta did not return a carousel item id.");
        children.push(childId);
        state.childContainerIds = children;
        await updatePublishState(database, post.id, state);
      }
      await Promise.all(children.map((childId) => waitForContainer(childId)));
      const created = await graphRequest(`${config.userId}/media`, {
        method: "POST",
        params: {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption,
        },
      });
      state.containerId = String(created.id || "");
      if (!state.containerId) throw new Error("Meta did not return a carousel container id.");
      await updatePublishState(database, post.id, state, state.containerId);
    }
  }

  await waitForContainer(state.containerId);
  const published = await graphRequest(`${config.userId}/media_publish`, {
    method: "POST",
    params: { creation_id: state.containerId },
  });
  const mediaId = String(published.id || "");
  if (!mediaId) throw new Error("Meta did not confirm the published media id.");

  let permalink = "";
  try {
    const details = await graphRequest(mediaId, { params: { fields: "id,permalink" } });
    permalink = String(details.permalink || "");
  } catch (error) {
    console.warn("Instagram post published, but its permalink could not be read.", {
      postId: post.id,
      mediaId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const publishedAt = new Date().toISOString();
  const { data: saved, error: saveError } = await database
    .from("social_posts")
    .update({
      status: "published",
      published_at: publishedAt,
      publishing_started_at: null,
      instagram_media_id: mediaId,
      instagram_permalink: permalink || null,
      error_message: null,
    })
    .eq("id", post.id)
    .eq("status", "publishing")
    .select("id,status,published_at,instagram_media_id,instagram_permalink")
    .single();
  if (saveError) throw saveError;
  console.info("Instagram post published.", { postId: post.id, mediaId });
  return saved;
};

const claimPost = async (database: SupabaseClient, postId?: string) => {
  const { data, error } = await database.rpc("claim_social_post", {
    p_post_id: postId || null,
  });
  if (error) throw error;
  return (data?.[0] || null) as SocialPost | null;
};

const markFailed = async (database: SupabaseClient, postId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : "Instagram publishing failed.";
  await database
    .from("social_posts")
    .update({
      status: "failed",
      publishing_started_at: null,
      error_message: message.slice(0, 1000),
    })
    .eq("id", postId)
    .eq("status", "publishing");
  console.error("Instagram publishing failed.", { postId, error: message });
  return message;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const database = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const authorization = await authorize(request, database);
  if (!authorization.ok) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  if (body?.action === "connection") {
    if (authorization.source !== "admin") return json({ error: "Admin access required." }, 403);
    try {
      const config = graphConfig();
      const account = await graphRequest(config.userId, {
        params: { fields: "id,username" },
      });
      return json({ connected: true, username: String(account.username || "") });
    } catch (error) {
      return json({
        connected: false,
        error: error instanceof Error ? error.message : "Instagram is not configured.",
      });
    }
  }

  const requestedPostId = typeof body?.postId === "string" ? body.postId : undefined;
  if (requestedPostId && authorization.source !== "admin") {
    return json({ error: "Cron cannot request a specific post." }, 403);
  }

  const results: unknown[] = [];
  const limit = requestedPostId ? 1 : 3;
  for (let index = 0; index < limit; index += 1) {
    let post: SocialPost | null = null;
    try {
      post = await claimPost(database, requestedPostId);
      if (!post) break;
      results.push(await publishPost(database, post));
    } catch (error) {
      if (post?.id) await markFailed(database, post.id, error);
      const message = error instanceof Error ? error.message : "Instagram publishing failed.";
      if (requestedPostId) return json({ error: message, postId: post?.id || requestedPostId }, 502);
      results.push({ postId: post?.id, status: "failed", error: message });
    }
  }

  if (requestedPostId && results.length === 0) {
    const { data: existing } = await database
      .from("social_posts")
      .select("id,status,published_at,instagram_media_id,instagram_permalink,error_message")
      .eq("id", requestedPostId)
      .maybeSingle();
    if (existing?.status === "published") return json({ post: existing });
    return json({ error: "This post is already publishing or cannot be published." }, 409);
  }

  return json(requestedPostId ? { post: results[0] } : { processed: results.length, results });
});
