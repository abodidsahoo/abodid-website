import crypto from "node:crypto";
import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
  parseRequestJson,
  safeInteger,
} from "../../../../lib/network/api";
import {
  buildContactEmbeddingText,
} from "../../../../lib/network/csv.js";
import {
  createNetworkEmbedding,
} from "../../../../lib/network/openrouter.js";
import { getRuntimeEnv } from "../../../../lib/vault-rag.js";

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
  const body = await parseRequestJson(request);
  const batchSize = safeInteger(body?.batchSize, 64, 1, 96);
  const contactId = typeof body?.contactId === "string" ? body.contactId.trim() : "";
  if (contactId && !UUID_PATTERN.test(contactId)) {
    return networkJson({ error: "Invalid contact id." }, 400);
  }

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response) return authorization.response;
  if (!authorization.context) {
    return networkJson({ error: "Administrator authorization is required." }, 401);
  }
  const { supabase, user } = authorization.context;

  let contactsQuery = supabase
    .from("network_contacts")
    .select([
      "id", "full_name", "source_company", "source_position", "company", "position",
      "city", "region", "country", "work_categories", "expertise_keywords", "tags",
      "outreach_goals", "relationship_context", "notes", "public_summary",
    ].join(","))
    .eq("owner_id", user.id)
    .eq("archived", false)
    .eq("embedding_refresh_needed", true);

  if (contactId) {
    contactsQuery = contactsQuery.eq("id", contactId);
  } else {
    contactsQuery = contactsQuery.order("updated_at", { ascending: true });
  }

  const { data: contacts, error } = await contactsQuery.limit(contactId ? 1 : batchSize);

  if (error) {
    console.error("[network] Embedding queue load failed:", error.message);
    return networkJson({ error: "Could not load the semantic indexing queue." }, 500);
  }

  if (!contacts?.length) {
    return networkJson({ processed: 0, remaining: 0, complete: true });
  }

  const embeddingInputs = contacts.map(buildContactEmbeddingText);
  const model = getRuntimeEnv("OPENROUTER_NETWORK_EMBEDDING_MODEL")
    || getRuntimeEnv("OPENROUTER_EMBEDDING_MODEL")
    || "openai/text-embedding-3-small";

  try {
    const embeddings = await createNetworkEmbedding(embeddingInputs, { model });
    const updates = contacts.map((contact: any, index: number) => ({
      id: contact.id,
      embedding: embeddings[index],
      model,
      hash: crypto
        .createHash("sha256")
        .update(embeddingInputs[index])
        .digest("hex"),
    }));

    const { data: processed, error: updateError } = await supabase.rpc(
      "update_network_contact_embeddings",
      {
        p_owner_id: user.id,
        p_rows: updates,
      },
    );
    if (updateError) throw updateError;

    const { count, error: countError } = await supabase
      .from("network_contacts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("archived", false)
      .eq("embedding_refresh_needed", true);
    if (countError) throw countError;

    return networkJson({
      processed: Number(processed || contacts.length),
      remaining: Number(count || 0),
      complete: Number(count || 0) === 0,
      model,
    });
  } catch (embeddingError) {
    console.error(
      "[network] Embedding batch failed:",
      embeddingError instanceof Error ? embeddingError.message : embeddingError,
    );
    return networkJson({
      error: embeddingError instanceof Error
        ? embeddingError.message
        : "The semantic indexing batch failed.",
    }, 502);
  }
};
