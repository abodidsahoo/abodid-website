import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { loadLandBundle } from '../../../../lib/land/privateData.mjs';
import { validateLandRevisionInput } from '../../../../lib/land/dataLogic.mjs';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;
  try {
    const bundle = await loadLandBundle();
    return jsonResponse(bundle);
  } catch {
    return jsonResponse({ error: 'The private land dataset is unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;

  let candidate: any;
  try {
    candidate = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const validation = validateLandRevisionInput(candidate);
  if (!validation.ok) return jsonResponse({ error: validation.error }, 400);

  const bundle = await loadLandBundle();
  const currentKhata = bundle.khatas.find((khata: any) =>
    khata.plots.some((plot: any) => plot.business_key === candidate.business_key),
  );
  const currentPlot = currentKhata?.plots.find((plot: any) => plot.business_key === candidate.business_key);
  if (candidate.change_type !== 'add' && !currentPlot) {
    return jsonResponse({ error: 'The selected plot no longer exists.' }, 404);
  }

  const beforeSnapshot = candidate.change_type === 'correct'
    ? candidate.patch.scope === 'khata'
      ? { value: currentKhata?.[candidate.patch.field] ?? null }
      : { value: currentPlot?.[candidate.patch.field] ?? null }
    : candidate.change_type === 'archive'
      ? { khata: currentKhata, plot: currentPlot }
      : null;

  const { data, error } = await authorization.supabase
    .from('family_land_revisions')
    .insert({
      change_type: candidate.change_type,
      business_key: candidate.business_key,
      patch: candidate.patch || {},
      before_snapshot: beforeSnapshot,
      reason: candidate.reason.trim(),
      source_reference: candidate.source_reference.trim(),
      created_by: authorization.user.id,
    })
    .select('id, change_type, business_key, patch, before_snapshot, reason, source_reference, created_by, created_at')
    .single();

  if (error) return jsonResponse({ error: 'The revision could not be saved.' }, 500);
  return jsonResponse({ revision: data }, 201);
};

