#!/usr/bin/env node
/** Isolated manual trial. Never changes application routing, image tags or vault vectors. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServer, loadEnv } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--run')) {
  console.log('Manual online trial (uses model credits):\n  node scripts/trial-ai-gateway.mjs --run\n  node scripts/trial-ai-gateway.mjs --run --only=vault --vault-provider=openrouter\nReports go to a fresh local temporary directory. A synthetic opportunity is briefly saved and automatically deleted.');
  process.exit(0);
}
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
assert(!only || ['moodboard', 'opportunity', 'vault'].includes(only), 'Invalid --only stage.');
const vaultProvider = process.argv.find(arg => arg.startsWith('--vault-provider='))?.split('=')[1] || 'gateway';
assert(['gateway', 'openrouter'].includes(vaultProvider), 'Invalid vault provider.');
const env = { ...loadEnv('development', root, ''), ...process.env };
const gatewayNeeded = !(only === 'vault' && vaultProvider === 'openrouter');
const gatewaySecrets = gatewayNeeded ? dotenv.parse(await readFile(path.join(root, '.env.gateway-trial.local'))) : {};
const key = gatewaySecrets.AI_GATEWAY_API_KEY;
assert(!gatewayNeeded || key, 'Missing trial key in .env.gateway-trial.local.');
assert(env.PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, 'Missing local database configuration.');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const model = process.env.GATEWAY_TRIAL_MODEL || 'google/gemini-2.5-flash';
const embeddingModel = 'openai/text-embedding-3-small';
const marker = '[Gateway trial]';
const secrets = [key, ...Object.entries(env).filter(([k]) => /KEY|TOKEN|SECRET|PASSWORD/.test(k)).map(([, v]) => v)].filter(v => typeof v === 'string' && v.length > 8);
const scrub = value => secrets.reduce((s, secret) => s.replaceAll(secret, '[REDACTED]'), String(value));
const out = await mkdtemp(path.join(os.tmpdir(), 'personal-site-gateway-trial-'));
const save = (name, value) => writeFile(path.join(out, name), scrub(JSON.stringify(value, null, 2)), { mode: 0o600 });
const summary = { startedAt: new Date().toISOString(), model, embeddingModel, scope: 'Local server-side experiment; production UI/auth/provider routing not exercised.', stages: {}, requests: [], unmeasuredProviderRequests: [] };
const vite = await createServer({ root, configFile: false, server: { middlewareMode: true }, appType: 'custom', envPrefix: '__NO_CLIENT_SECRETS__', logLevel: 'error' });
let quotaStopped = false;

async function gateway(endpoint, body, label) {
  const started = performance.now();
  const response = await fetch(`https://ai-gateway.vercel.sh/v1/${endpoint}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.json();
  summary.requests.push({ label, status: response.status, model: payload.model || body.model, latencyMs: Math.round(performance.now() - started), usage: payload.usage || null });
  if (!response.ok) {
    if ([402, 429].includes(response.status)) quotaStopped = true;
    throw Error(`Gateway HTTP ${response.status}: ${scrub(payload.error?.message || JSON.stringify(payload.error || {})).slice(0, 500)}`);
  }
  return payload;
}

async function stage(name, task) {
  if (only && only !== name) return;
  if (quotaStopped) {
    summary.stages[name] = { status: 'skipped', reason: 'Stopped on credit/rate limit; no automatic retries.' };
  } else {
    try { summary.stages[name] = { status: 'passed', ...await task() }; }
    catch (error) { summary.stages[name] = { status: 'failed', error: scrub(error.message) }; }
  }
  await save('results.json', summary);
  console.log(JSON.stringify({ stage: name, ...summary.stages[name] }));
}

try {
  await stage('moodboard', async () => {
    const tagging = await vite.ssrLoadModule('/src/lib/moodboard/tagging.ts');
    const { data: item, error } = await db.from('moodboard_items')
      .select('id,image_url,title,tags,artist_name,updated_at')
      .eq('id', '0bf62bae-1e22-404b-8935-2b787db262d0').single();
    if (error) throw error;
    await save('moodboard-before.json', item);
    const { data: vocabulary, error: vocabularyError } = await db.from('moodboard_items').select('tags').limit(1000);
    if (vocabularyError) throw vocabularyError;
    const payload = await gateway('chat/completions', {
      model, temperature: 0.2, max_tokens: 650, reasoning: { enabled: false },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: tagging.MASTER_TAG_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: tagging.buildMasterTagUserPrompt({ title: item.title, artistName: item.artist_name, existingTags: item.tags, vocabularyHints: tagging.buildVocabularyHints(vocabulary) }) },
          { type: 'image_url', image_url: { url: item.image_url } },
        ] },
      ],
    }, 'moodboard');
    const tags = tagging.parseMasterTagResponse(payload);
    assert(tags.length > 0 && tags.length <= 40, 'Invalid tag count.');
    assert(tags.every(tag => tag === tag.toLowerCase()), 'Tags must be lowercase.');
    const merged = tagging.mergeProtectedTags(item.tags, tags);
    assert((item.tags || []).every(tag => merged.tags.includes(tag)), 'Protected tag missing.');
    const { data: after, error: afterError } = await db.from('moodboard_items').select('tags,updated_at').eq('id', item.id).single();
    if (afterError) throw afterError;
    assert.deepEqual(after.tags, item.tags, 'Tags changed during trial; investigate concurrent editing.');
    assert.equal(after.updated_at, item.updated_at, 'Image changed during trial; investigate concurrent editing.');
    const result = { item, generatedTags: tags, proposedMergedTags: merged.tags, saved: false, sourceOfRules: 'public/docs/ABODID_MASTER_TAG_BUILDER.md v1.2.0', promptVersion: tagging.MASTER_TAGGING_VERSION, experimentalProviderOverride: true, qualityReviewRequired: true, passedChecks: 'Transport, parsing, tag count, lowercase and unchanged live data only; not editorial acceptance.' };
    await save('moodboard.json', result);
    return { imageUrl: item.image_url, generatedTags: tags, tagCount: tags.length, existingTagsUnchanged: true, qualityReviewRequired: true };
  });

  await stage('opportunity', async () => {
    const { OPPORTUNITY_EXTRACTION_SYSTEM_PROMPT } = await vite.ssrLoadModule('/src/lib/opportunities/extractionPrompt.ts');
    const { LLMExtractionOutputSchema } = await vite.ssrLoadModule('/src/lib/opportunities/types.ts');
    const { createOpportunityFromPayload } = await vite.ssrLoadModule('/src/lib/opportunities/createOpportunityService.ts');
    const { data: owner, error: ownerError } = await db.from('profiles').select('id,username').eq('username', 'abodid').single();
    if (ownerError) throw ownerError;
    // Verify the reserved founder identity before any write; never choose an arbitrary profile.
    const { data: auth, error: authError } = await db.auth.admin.getUserById(owner.id);
    if (authError) throw authError;
    assert.equal(auth.user.email?.toLowerCase(), 'abodidsahoo@gmail.com', 'Founder identity did not match.');
    const sourceUrl = `https://example.com/gateway-trial/${randomUUID()}`;
    const fixture = `${marker} Creative Research Fellowship (synthetic test, not a real open call).\nOrganisation: Gateway Trial Studio.\nCategory: fellowship.\nApplications close 15 November 2026 at 17:00 India Standard Time.\nLocation: Online.\nRequirements: A portfolio and a 300-word project proposal.\nFunding: INR 10,000.\nNo application fee.\nApply: ${sourceUrl}/apply\nNext action: Prepare a project proposal.`;
    const response = await gateway('chat/completions', {
      model, temperature: 0.1, max_tokens: 1200, reasoning: { enabled: false },
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: OPPORTUNITY_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `SOURCE URL: ${sourceUrl}\nBROWSER TIMEZONE: Asia/Kolkata\nPAGE:\n${fixture}` }],
    }, 'opportunity');
    const extracted = LLMExtractionOutputSchema.parse(JSON.parse(response.choices[0].message.content));
    assert.equal(extracted.category, 'fellowship');
    assert(extracted.deadline && /2026/.test(extracted.deadline), 'Expected an explicit deadline.');
    assert.equal(extracted.application_url, `${sourceUrl}/apply`, 'Application link changed.');
    const testTitle = `${marker} ${extracted.title.replace(/^\[Gateway trial\]\s*/i, '')}`;
    await save('opportunity-cleanup.json', { userId: owner.id, canonicalUrl: sourceUrl, title: testTitle, note: 'Delete only this exact synthetic row if interrupted.' });
    let savedId;
    let result;
    try {
      const created = await createOpportunityFromPayload({ userId: owner.id, client: db, body: {
        ...extracted, title: testTitle, source_url: sourceUrl,
        reminder_offsets_minutes: [], reminder_at_target: false,
        notes: `${marker} Synthetic local integration test; safe to remove.`,
      }, extractionMetadata: { model: response.model || model, count: 1 } });
      assert.equal(created.isDuplicate, false, 'Unexpected duplicate; do not delete existing data.');
      savedId = created.opportunity.id;
      await save('opportunity-cleanup.json', { userId: owner.id, canonicalUrl: sourceUrl, id: savedId, title: testTitle });
      const { data: readback, error: readError } = await db.from('saved_opportunities').select('*').eq('id', savedId).eq('user_id', owner.id).single();
      if (readError) throw readError;
      assert.equal(readback.title, testTitle);
      assert.equal(readback.deadline_at, '2026-11-15T11:30:00+00:00');
      assert.deepEqual(readback.content.reminder_offsets_minutes, []);
      const { count, error: reminderError } = await db.from('opportunity_reminders').select('id', { count: 'exact', head: true }).eq('opportunity_id', savedId);
      if (reminderError) throw reminderError;
      assert.equal(count, 0, 'Unexpected reminder scheduled.');
      result = { extracted, savedId, savedAndReadBack: true, reminderCount: count, deadlineVerified: true, browserAuthTested: false, fixture: 'synthetic', cleanup: 'pending' };
      await save('opportunity.json', result);
    } finally {
      // Canonical URL is unique to this run. Also catches an insert followed by a crash before id capture.
      const { error: cleanupError } = await db.from('saved_opportunities').delete().eq('user_id', owner.id).eq('canonical_url', sourceUrl).like('notes', `${marker}%`);
      if (cleanupError) throw Error(`Cleanup failed. Use opportunity-cleanup.json: ${cleanupError.message}`);
      const { count, error: verifyError } = await db.from('saved_opportunities').select('id', { count: 'exact', head: true }).eq('user_id', owner.id).eq('canonical_url', sourceUrl);
      if (verifyError) throw verifyError;
      assert.equal(count, 0, 'Trial row still present.');
      if (result) { result.cleanup = 'deleted and absence verified'; await save('opportunity.json', result); }
    }
    return result;
  });

  await stage('vault', async () => {
    const question = 'How can uncertainty and not knowing support creative research?';
    const { data: sample, error: sampleError } = await db.from('obsidian_chunks').select('embedding_model,embedding').eq('is_public', true).eq('embedding_model', embeddingModel).limit(1).single();
    if (sampleError) throw sampleError;
    const storedVector = typeof sample.embedding === 'string' ? JSON.parse(sample.embedding) : sample.embedding;
    assert.equal(storedVector.length, 1536, 'Index dimensions mismatch; do not re-embed the vault.');
    let vector;
    if (vaultProvider === 'openrouter') {
      // Explicit baseline mode: exercise the existing implementation, never silently switch providers.
      const { createEmbedding } = await vite.ssrLoadModule('/src/lib/vault-rag.js');
      summary.unmeasuredProviderRequests.push({ provider: 'openrouter', endpoint: 'embeddings', model: embeddingModel, note: 'Existing helper returns vectors without usage; cost not measured by this script.' });
      vector = await createEmbedding(question, { apiKey: env.OPENROUTER_API_KEY, model: embeddingModel, dimensions: 1536 });
    } else {
      const response = await gateway('embeddings', { model: embeddingModel, input: question, dimensions: 1536 }, 'vault-embedding');
      vector = response.data?.[0]?.embedding;
    }
    assert.equal(vector?.length, 1536, 'Query embedding has wrong dimensions.');
    assert(vector.every(Number.isFinite), 'Invalid query vector.');
    const { data: matches, error } = await db.rpc('match_obsidian_chunks', {
      query_embedding: vector, match_count: 6, match_threshold: 0.16,
      public_only: true, tag_filter: null, folder_filter: null, file_path_filter: null,
    });
    if (error) throw error;
    assert(matches?.length, 'No semantic matches returned.');
    const ids = matches.map(row => row.id);
    const { data: visibility, error: visibilityError } = await db.from('obsidian_chunks').select('id,is_public,embedding_model').in('id', ids);
    if (visibilityError) throw visibilityError;
    assert.equal(visibility.length, matches.length);
    assert(visibility.every(row => row.is_public && row.embedding_model === embeddingModel), 'Visibility or model mismatch.');
    const result = { question, provider: vaultProvider, embeddingModel, dimensions: vector.length, semanticOnly: true, keywordFallbackUsed: false, indexModified: false, matches: matches.map(row => ({ id: row.id, title: row.note_title, heading: row.heading, similarity: row.similarity, excerpt: row.chunk_text.slice(0, 650) })) };
    await save('vault.json', result);
    return result;
  });
} finally {
  await vite.close();
  summary.finishedAt = new Date().toISOString();
  summary.reportedGatewayCostUsd = summary.requests.reduce((sum, r) => sum + (Number(r.usage?.cost) || 0), 0);
  await save('results.json', summary);
  console.log(JSON.stringify({ reportDirectory: out, reportedGatewayCostUsd: summary.reportedGatewayCostUsd, unmeasuredProviderRequests: summary.unmeasuredProviderRequests }));
}
if (Object.values(summary.stages).some(stage => stage.status !== 'passed')) process.exitCode = 1;
