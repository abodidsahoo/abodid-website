#!/usr/bin/env node
/** Local read-only experiment. Never calls tracker endpoints, writes DB rows, or deploys. */
import { createServer, loadEnv } from 'vite';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...loadEnv('development', root, ''), ...process.env };
const benchmarkRoot = path.join(root, '.local/benchmarks/openrouter-free-opportunity');
const out = process.env.BENCHMARK_OUTPUT_DIR || (process.argv.includes('--report-only') ? benchmarkRoot : path.join(benchmarkRoot, `trial-${new Date().toISOString().replaceAll(':', '-')}`));
const modelIds = (process.env.BENCHMARK_FREE_MODELS || 'nvidia/nemotron-3.5-super-vl:free').split(',');
const repetitions = Number(process.env.BENCHMARK_REPETITIONS || 3);
const profile = process.env.BENCHMARK_PROFILE || (process.env.BENCHMARK_FREE_MODELS ? 'production' : 'compatible');
if (!['production','compatible'].includes(profile)) throw Error('Benchmark profile must be production or compatible.');
const disableReasoning = process.env.BENCHMARK_DISABLE_REASONING === undefined ? profile === 'compatible' : process.env.BENCHMARK_DISABLE_REASONING === '1';
const reasoningEffort = process.env.BENCHMARK_REASONING_EFFORT;
const strictSchema = process.env.BENCHMARK_STRICT_SCHEMA === undefined ? profile === 'compatible' : process.env.BENCHMARK_STRICT_SCHEMA === '1';
const maxTokens = process.env.BENCHMARK_MAX_TOKENS === undefined ? null : Number(process.env.BENCHMARK_MAX_TOKENS);
if (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 300 || maxTokens > 8192)) throw Error('Benchmark output budget must be 300–8192 tokens.');
if (disableReasoning && reasoningEffort) throw Error('Choose reasoning disabled or an effort, not both.');
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) throw Error('Repetitions must be 1–3.');
if (!process.argv.includes('--report-only')) {
    if (!env.OPENROUTER_API_KEY) throw Error('Missing local OPENROUTER_API_KEY. No API experiment was run.');
    if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Missing read-only baseline prerequisites.');
}
const secretValues = Object.entries(env).filter(([key, value]) => /KEY|TOKEN|SECRET|PASSWORD/.test(key) && typeof value === 'string' && value.length > 8).map(([,value]) => value);
const scrub = (text) => secretValues.reduce((value, secret) => value.replaceAll(secret, '[REDACTED]'), String(text));
await mkdir(out, { recursive: true, mode: 0o700 });
const save = (name, value) => writeFile(path.join(out, name), scrub(typeof value === 'string' ? value : JSON.stringify(value, null, 2)), { mode: 0o600 });
const title = 'Digital Ethnography as a Way of Knowing: A Conversation with Sarah Pink';
const sourceUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:7517185356413390848/';
const meetingUrl = 'https://www.youtube.com/watch?v=htbgP85T2yc';
const id = '524dcc0d-cc0e-49eb-bf08-91eca5e87cb6';
const fixture = `Doing Sociology — posted 16 October 2026

${title}

Sarah Pink is an award-winning design and futures anthropologist and documentary filmmaker whose work is internationally influential, both within and beyond academia. Sarah is an Australian Research Council Laureate Professor and holds honorary doctorates from Malmo and Halmstad Universities in Sweden. Pink is currently Professor and Director of FUTURES Hub and the Emerging Technologies Research Lab at Monash, where she engages and innovates interdisciplinary and international research approaches to offer fresh perspectives and realistic future visions and foresight about the role of human futures in shaping digital and net zero transitions.

31 October 2026, 5 pm IST`;
const routerHeaders = { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://abodid.com/opportunities', 'X-Title': 'Opportunity Tracker Free Model Benchmark' };
const dbHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const metrics = { openrouter_catalogue_gets: 0, supabase_gets: 0, completion_posts: 0, scraper_attempts: 0, paid_fallback_requests: 0 };
const requestJson = async (url, headers) => {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(28000) });
    const payload = await response.json();
    if (!response.ok) throw Error(`Read-only GET failed (HTTP ${response.status}): ${scrub(payload.message || payload.error?.message || '')}`);
    return payload;
};
if (process.argv.includes('--report-only')) { await writeBenchmarkReport(); process.exit(0); }
try {
    await readFile(path.join(out, 'results.json'));
    throw Error('Existing benchmark results would be overwritten. Choose a fresh BENCHMARK_OUTPUT_DIR.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const vite = await createServer({ root, configFile: false, server: { middlewareMode: true }, appType: 'custom', envPrefix: '__BENCHMARK_NO_CLIENT_SECRETS__', logLevel: 'error' });
const originalFetch = globalThis.fetch;
const previousKey = process.env.OPENROUTER_API_KEY;
const results = [];
try {
    const extractor = await vite.ssrLoadModule('/src/lib/opportunities/extractor.ts');
    const { LLMExtractionOutputSchema } = await vite.ssrLoadModule('/src/lib/opportunities/types.ts');
    const { savedRowToOpportunity } = await vite.ssrLoadModule('/src/lib/opportunities/saved.ts');
    const { fetchWebpageContent } = await vite.ssrLoadModule('/src/lib/opportunities/scraper.ts');
    metrics.supabase_gets++;
    const dbUrl = new URL(`${env.PUBLIC_SUPABASE_URL}/rest/v1/saved_opportunities`);
    dbUrl.searchParams.set('id', `eq.${id}`);
    dbUrl.searchParams.set('select', 'id,title,source_url,deadline_at,created_at,updated_at,content');
    const rows = await requestJson(dbUrl, dbHeaders);
    if (rows.length !== 1 || rows[0].source_url !== sourceUrl) throw Error('Exact saved baseline not found.');
    const baseline = savedRowToOpportunity(rows[0]);
    await save('baseline.json', { retrieved_at: new Date().toISOString(), row: rows[0], mapped: baseline });

    let retrieval;
    metrics.scraper_attempts++;
    try {
        const page = await fetchWebpageContent(sourceUrl);
        retrieval = { status: page.status, title: page.title, text_length: page.text.length, target_visible: page.text.includes(title), method: 'production scraper' };
        // A successful HTTP response can still be a LinkedIn login wall or omit the pinned comment.
        retrieval.full_verified_bio_present = page.text.includes('realistic future visions and foresight');
        retrieval.event_text_present = /31\s+October\s+2026[\s\S]{0,60}5\s*pm/i.test(page.text);
        retrieval.literal_pinned_youtube_url_present = page.text.includes(meetingUrl);
        retrieval.fixture_reason = 'Use the user-verified fixture to isolate the target post and pinned link from unrelated page chrome; record source-presence checks separately.';
    } catch (error) { retrieval = { method: 'production scraper', error: scrub(error.message), fixture_reason: 'LinkedIn blocked automatic retrieval; use the user-verified source fixture.' }; }
    await save('retrieval.json', retrieval);
    const sourceText = `${fixture}\n\nLINK TARGETS:\nPinned comment — YouTube: ${meetingUrl}`;
    const context = { sourceUrl, capturedAt: baseline.extracted_at, timezone: 'Asia/Kolkata' };
    await save('source.json', { origin: 'user-verified fixture plus user-provided pinned comment', retrieval, context, text: sourceText, sha256: createHash('sha256').update(sourceText).digest('hex') });

    // Instrument the production request builder OFFLINE. This synthetic response is never
    // counted as a benchmark result or sent to a provider. No paid request can escape this stub.
    let template;
    process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
    globalThis.fetch = async (url, options) => {
        if (String(url) !== 'https://openrouter.ai/api/v1/chat/completions') throw Error('Unexpected offline instrumentation URL');
        template = JSON.parse(options.body);
        return new Response(JSON.stringify({ model: 'offline-request-capture-only', choices: [{ message: { content: JSON.stringify({ title: 'Request capture only', organisation: 'Benchmark', category: 'other', requirements: [] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try { await extractor.extractOpportunityWithLLM(sourceText, title, context); }
    finally { globalThis.fetch = originalFetch; if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey; }
    if (!template?.messages || template.messages[0].content !== extractor.getExtractionSystemPrompt()) throw Error('Production prompt capture failed.');
    delete template.models;
    // Benchmark-only override: production's 1200/2000 budget can be exhausted by
    // mandatory reasoning before any visible JSON. Never change production env/config.
    if (maxTokens !== null) template.max_tokens = maxTokens;
    if (strictSchema) {
        // Convert the actual production Zod input schema; never duplicate the
        // extraction contract or repair null arrays after receiving a response.
        const { zodToJsonSchema } = await import('zod-to-json-schema');
        const schema = zodToJsonSchema(LLMExtractionOutputSchema, { $refStrategy: 'none', effectStrategy: 'input' });
        delete schema.$schema;
        // Strict wire output includes every production field, including nullable
        // optional fields, so parser defaults cannot conceal omitted model output.
        schema.required = Object.keys(schema.properties);
        for (const property of Object.values(schema.properties)) delete property.default;
        template.response_format = { type: 'json_schema', json_schema: { name: 'opportunity_extraction', strict: true, schema } };
    }
    await save('request-template.json', { ...template, offline_instrumentation: 'Only captures production request construction; no inference or network request is performed here.' });
    metrics.openrouter_catalogue_gets++;
    const catalogue = await requestJson('https://openrouter.ai/api/v1/models', routerHeaders);
    await save('catalogue.json', { retrieved_at: new Date().toISOString(), ...catalogue });
    const selected = modelIds.map((modelId) => {
        const model = catalogue.data.find((item) => item.id === modelId);
        if (!model || !modelId.endsWith(':free') || model.pricing?.prompt === undefined || model.pricing?.completion === undefined || Number(model.pricing.prompt) !== 0 || Number(model.pricing.completion) !== 0 || Number(model.pricing.request || 0) !== 0) throw Error(`Not verified free: ${modelId}`);
        if (!model.supported_parameters?.includes('response_format')) throw Error(`JSON response_format unavailable: ${modelId}`);
        if (strictSchema && !model.supported_parameters?.includes('structured_outputs')) throw Error(`Structured outputs unavailable: ${modelId}`);
        if (disableReasoning && model.reasoning?.mandatory) throw Error(`Reasoning is mandatory: ${modelId}; increase the benchmark output budget instead.`);
        if (reasoningEffort && !model.reasoning?.supported_efforts?.includes(reasoningEffort)) throw Error(`Reasoning effort not advertised for ${modelId}: ${reasoningEffort}`);
        if (template.max_tokens > model.top_provider?.max_completion_tokens) throw Error(`Output budget exceeds model limit: ${modelId}`);
        return model;
    });
    await save('selected-models.json', selected);
    console.log(JSON.stringify({ phase: 'ready', baseline_model: baseline.llm_model, retrieval, selected: selected.map((m) => ({ id: m.id, pricing: m.pricing })), temperature: template.temperature, max_tokens: template.max_tokens }));
    for (const model of selected) {
        for (let run = 1; run <= repetitions; run++) {
            const body = { ...template, model: model.id, ...(disableReasoning ? { reasoning: { enabled: false } } : reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}), provider: { require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0 } } };
            if (body.models || !body.model.endsWith(':free')) throw Error('Paid fallback guard failed.');
            const result = { phase: process.env.BENCHMARK_PHASE || (disableReasoning ? 'diagnostic: reasoning disabled' : 'production inference settings'), requested_model: model.id, run, started_at: new Date().toISOString(), timeout_ms: 28000 };
            result.request_parameters = { temperature: body.temperature, max_tokens: body.max_tokens, response_format: body.response_format, reasoning: body.reasoning || null, provider: body.provider };
            const started = performance.now();
            metrics.completion_posts++;
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: routerHeaders, body: JSON.stringify(body), signal: AbortSignal.timeout(28000) });
                const raw = await response.text();
                result.latency_ms = Math.round(performance.now() - started);
                result.http_status = response.status;
                await save(`${model.id.replaceAll('/', '--')}-run-${run}-response.json`, raw);
                const payload = JSON.parse(raw);
                result.actual_model = payload.model || null;
                result.response_id = payload.id || null;
                result.provider = payload.provider || null;
                result.usage = payload.usage || null;
                result.provider_error_metadata = payload.error?.metadata || null;
                result.finish_reason = payload.choices?.[0]?.finish_reason || null;
                result.raw_content = payload.choices?.[0]?.message?.content ?? null;
                // Check charge and truncation before parsing: partial JSON and
                // reasoning-only responses must never count as usable extraction.
                if (Number(result.usage?.cost || 0) > 0) throw Error('Unexpected nonzero charge; stop experiment');
                if (!response.ok || payload.error) throw Error(`HTTP ${response.status}: ${payload.error?.message || 'Provider error'}`);
                if (result.actual_model?.replace(/:free$/, '') !== model.id.replace(/:free$/, '')) throw Error('Unexpected returned model identity');
                const content = result.raw_content?.trim();
                if (!content) throw Error(result.finish_reason === 'length' ? 'Output budget exhausted before visible JSON; increase budget or use a supported reasoning control' : 'Empty model response');
                if (result.finish_reason === 'length') throw Error('Truncated model response; increase output budget');
                try { JSON.parse(content); result.strict_json = true; } catch { result.strict_json = false; }
                let json = content;
                if (json.startsWith('```json')) json = json.slice(7).replace(/```$/, '').trim();
                else if (json.startsWith('```')) json = json.slice(3).replace(/```$/, '').trim();
                result.output = JSON.parse(json);
                const validation = LLMExtractionOutputSchema.safeParse(result.output);
                result.schema_valid = validation.success;
                if (!validation.success) { result.validation_errors = validation.error.issues; throw Error('Production JSON schema validation failed'); }
                result.validated = validation.data;
                const parsed = validation.data;
                result.normalized = { ...parsed, ...extractor.resolveOpportunityDeadline(parsed.deadline, parsed.timezone, sourceText), event_date: extractor.parseEventDate(parsed.event_date, context.capturedAt, context.timezone) };
                result.all_14_fields_present = ['title','organisation','category','deadline','timezone','event_date','location','requirements','next_action','application_url','meeting_url','fee_or_funding','application_fee','summary'].every((key) => Object.hasOwn(result.output, key));
                result.schema_defaults_or_transforms_applied = JSON.stringify(result.output) !== JSON.stringify(parsed);
                if (!result.all_14_fields_present) throw Error('Incomplete extraction: production defaults concealed omitted fields');
                if (Number(result.usage?.cost || 0) > 0) throw Error('Unexpected nonzero charge; stop experiment');
            } catch (error) { result.error = scrub(error.message); result.latency_ms ??= Math.round(performance.now() - started); }
            results.push(result);
            await save('results.json', { executed_at: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), metrics, results });
            console.log(JSON.stringify({ model: model.id, run, actual_model: result.actual_model, latency_ms: result.latency_ms, status: result.http_status, schema_valid: result.schema_valid, usage: result.usage, error: result.error, output: result.output }));
            if (/Unexpected nonzero charge|Unexpected returned model/.test(result.error || '')) throw Error(result.error);
            if ([400, 401, 403].includes(result.http_status)) break;
            if (run < repetitions) await new Promise((resolve) => setTimeout(resolve, 3500));
        }
    }
    console.log(JSON.stringify({ phase: 'complete', metrics, artifacts: out }));
    if (!process.argv.includes('--no-report')) await writeBenchmarkReport();
} finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey;
    await vite.close();
}


async function writeBenchmarkReport() {
    const phases = ['', ...(await readdir(out, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()];
    const experiments = [];
    for (const folder of phases) {
        try {
            const dir = path.join(out, folder);
            experiments.push({ folder, dir, ...(JSON.parse(await readFile(path.join(dir, 'results.json'), 'utf8'))), source: JSON.parse(await readFile(path.join(dir, 'source.json'), 'utf8')), request: JSON.parse(await readFile(path.join(dir, 'request-template.json'), 'utf8')) });
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!experiments.length) throw Error('No executed results found.');
    const baselineFile = JSON.parse(await readFile(path.join(out, 'baseline.json'), 'utf8'));
    const baseline = baselineFile.mapped || { ...baselineFile.rows[0].content, ...baselineFile.rows[0] };
    const runs = experiments.flatMap((phase) => phase.results.map((run) => ({ ...run, folder: phase.folder, max_tokens: phase.request.max_tokens })));
    if (new Set(experiments.map((phase) => phase.source.sha256)).size !== 1) throw Error('Experiments do not share identical source text.');
    if (new Set(experiments.map((phase) => phase.request.messages[0].content)).size !== 1) throw Error('Experiments do not share the same production system prompt.');
    const valid = runs.filter((run) => run.schema_valid && !run.error);
    const representative = valid[0] || null;
    let sourceInspection = null;
    try { sourceInspection = JSON.parse(await readFile(path.join(out, 'retrieval-inspection.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const defaultCount = runs.filter((r)=>r.max_tokens===1200&&!r.folder.includes('reasoning-disabled')&&!r.request_parameters?.reasoning&&r.request_parameters?.response_format?.type!=='json_schema').length;
    const diagnosticCount = runs.length-defaultCount;
    const empty = runs.filter((run) => run.http_status === 200 && !run.raw_content);
    const critical = new Set(['category','event_date','event_time','deadline_at','deadline_timezone','requirements','meeting_url','application_url','fee_or_funding','application_fee']);
    const expectedIso = '2026-10-31T11:30:00.000Z';
    const rows = [
        ['title','Title',baseline.title,title,'Exact opportunity heading'],
        ['organisation','Organisation',baseline.organisation,'Doing Sociology','Organiser named in the post'],
        ['category','Category',baseline.category,'event','A scheduled conversation/talk, not an application'],
        ['event_date','Event date',baseline.event_date,expectedIso,'31 October 2026, 5 pm IST = 11:30 UTC'],
        ['event_time','Event time / timezone','17:00 IST (Asia/Kolkata, UTC+05:30)','17:00 IST (Asia/Kolkata, UTC+05:30)','The stated IST belongs to the event start'],
        ['deadline_at','Application deadline',baseline.deadline_at,null,'No apply-by or submission deadline is stated'],
        ['deadline_timezone','Deadline timezone',baseline.deadline_timezone,null,'No application deadline exists; event IST is not its timezone'],
        ['location','Location',baseline.location,'Online or null','YouTube implies online attendance; null is also defensible because no location is stated explicitly'],
        ['requirements','Requirements',baseline.requirements,[],'No submission materials or eligibility conditions stated'],
        ['meeting_url','Meeting URL',baseline.meeting_url,meetingUrl,'Literal URL supplied in the verified pinned comment'],
        ['application_url','Application URL',baseline.application_url,null,'No submission or registration portal supplied'],
        ['fee_or_funding','Fee or funding',baseline.fee_or_funding,null,'No award, salary or funding stated'],
        ['application_fee','Application fee',baseline.application_fee,null,'No application fee or explicit free-application claim'],
        ['summary','Summary',baseline.summary,'Equivalent concise description of the conversation with Sarah Pink','Title and speaker biography; do not add benefits, fees or eligibility'],
        ['next_action','Next action',baseline.next_action,'Watch / attend the conversation via the supplied YouTube link','The video URL is the supported next step'],
    ];
    const show = (value) => value === undefined ? 'Missing' : value === null ? 'null' : Array.isArray(value) ? JSON.stringify(value) : String(value);
    const assess = (key, value) => {
        if (value === undefined) return 'Missing';
        if (['deadline_at','deadline_timezone','application_url','fee_or_funding','application_fee'].includes(key)) return value === null ? 'Correct' : 'Unsupported / hallucinated';
        if (key === 'requirements') return Array.isArray(value) && !value.length ? 'Correct' : 'Unsupported / hallucinated';
        if (key === 'category') return value === 'event' ? 'Correct' : 'Incorrect';
        if (key === 'title') return String(value).trim().toLowerCase() === title.toLowerCase() ? 'Correct' : 'Partially correct';
        if (key === 'organisation') return String(value).trim().toLowerCase() === 'doing sociology' ? 'Correct' : 'Incorrect';
        if (key === 'meeting_url') return value === meetingUrl ? 'Correct' : value ? 'Incorrect' : 'Missing';
        if (key === 'event_date') return Date.parse(value) === Date.parse(expectedIso) ? 'Correct' : value ? 'Incorrect' : 'Missing';
        if (key === 'event_time') return value === '17:00 IST (Asia/Kolkata, UTC+05:30)' ? 'Correct' : 'Incorrect';
        if (key === 'location') return value === null || /online|remote|youtube/i.test(value) ? 'Correct' : 'Unsupported / hallucinated';
        if (key === 'summary') return value && /sarah pink/i.test(value) && /ethnograph/i.test(value) ? 'Correct' : value ? 'Partially correct' : 'Missing';
        if (key === 'next_action') return value && /youtube|watch|attend|tune|listen/i.test(value) ? 'Correct' : value ? 'Partially correct' : 'Missing';
        return 'Missing';
    };
    const comparison = rows.map(([key,label,saved,expected,evidence]) => {
        let extracted = representative?.normalized?.[key];
        if (representative && key === 'event_time') extracted = Date.parse(representative.normalized.event_date) === Date.parse(expectedIso) ? '17:00 IST (Asia/Kolkata, UTC+05:30)' : representative.normalized.event_date;
        return { key,label,saved,free:extracted,expected,evidence,critical:critical.has(key),saved_assessment:key === 'deadline_timezone' && saved !== null ? 'Incorrect' : assess(key,saved),free_assessment:assess(key,extracted) };
    });
    const knownUsage = runs.filter((run) => run.usage);
    const aggregate = { completed_at:new Date().toISOString(), source_sha256:experiments[0].source.sha256, same_source_and_prompt:true, completion_requests:runs.length, production_setting_requests:defaultCount, valid_json_outputs:valid.length, empty_http_200_responses:empty.length, known_usage_receipts:knownUsage.length, known_prompt_tokens:knownUsage.reduce((n,r)=>n+r.usage.prompt_tokens,0), known_completion_tokens:knownUsage.reduce((n,r)=>n+r.usage.completion_tokens,0), known_reported_cost_usd:knownUsage.reduce((n,r)=>n+(r.usage.cost||0),0), saved_correct_fields:comparison.filter((r)=>r.saved_assessment==='Correct').length, total_fields:15, critical_fields:critical.size, free_factual_accuracy:representative ? comparison.filter((r)=>r.free_assessment==='Correct').length/15 : null, free_critical_accuracy:representative ? comparison.filter((r)=>r.critical&&r.free_assessment==='Correct').length/critical.size : null, free_field_completion:representative ? comparison.filter((r)=>r.free_assessment!=='Missing').length/15 : 0, paid_fallback_requests:0, database_writes:0 };
    const cell = (value) => show(value).replaceAll('|','\\|').replaceAll('\n',' ');
    const lines = ['# Free OpenRouter opportunity benchmark — executed results', '', '## A. Actual free-model output', '', representative ? `The first validated output was returned by ${representative.actual_model}:` : '**No model returned structured extraction JSON in any of the executed requests.** No fields have been fabricated from hidden reasoning, the saved baseline, or the source fixture.', '', representative ? '```json\n'+JSON.stringify(representative.output,null,2)+'\n```' : `The ${empty.length} HTTP 200 responses had choices[0].message.content: null and finish_reason: length. Their reasoning text is not a structured extraction. Other requests failed at the provider, timed out, or were rate limited.`, '', '## B. Side-by-side comparison', '', `Live baseline: record ${id}; model ${baseline.llm_model}; retrieved ${baselineFile.retrieved_at}. Source of truth is the user-verified post fixture plus the literal pinned YouTube URL.`, '', '| Field | Existing model | Free model | Source evidence | Assessment |', '|---|---|---|---|---|'];
    for (const row of comparison) lines.push(`| ${row.label} | ${cell(row.saved)} | ${cell(row.free)} | ${row.evidence} | Existing: ${row.saved_assessment}; Free: ${row.free_assessment} |`);
    lines.push('', `Saved baseline: **${aggregate.saved_correct_fields}/15 fields correct**; its deadline timezone has an event/deadline scope error.`, '', representative ? `Free factual accuracy: ${aggregate.free_factual_accuracy}; critical accuracy: ${aggregate.free_critical_accuracy}.` : '**Free factual accuracy: not measurable. Critical-field accuracy: not measurable.** No valid output reached scoring. Delivered-field coverage is 0/15 and critical-field coverage is 0/10; these are delivery failures, not evidence of wrong answers or hallucinations.', '', 'Critical fields: category, event instant, event time/timezone, application deadline, deadline timezone, requirements, meeting URL, application URL, funding and application fee.', '', '## C. Performance and cost', '', '| Phase / requested model | Run | Actual model | HTTP / result | Seconds | Input tokens | Output tokens | Reported USD | JSON/schema |', '|---|---:|---|---|---:|---:|---:|---:|---|');
    for(const run of runs) lines.push(`| ${run.folder||'default'} / ${run.requested_model} | ${run.run} | ${run.actual_model||'Not returned'} | ${run.http_status||'Timeout'} / ${cell(run.error||'Valid')} | ${(run.latency_ms/1000).toFixed(3)} | ${run.usage?.prompt_tokens??'Not supplied'} | ${run.usage?.completion_tokens??'Not supplied'} | ${run.usage?.cost??'Not supplied'} | ${run.schema_valid?'Valid':run.output?'JSON; schema invalid':'No JSON'} |`);
    const scores = valid.map((run) => {
        const fields = rows.map(([key]) => {
            let value = run.normalized[key];
            if (key === 'event_time') value = Date.parse(run.normalized.event_date) === Date.parse(expectedIso) ? '17:00 IST (Asia/Kolkata, UTC+05:30)' : run.normalized.event_date;
            return { key, assessment: assess(key, value), value };
        });
        return { folder:run.folder, model:run.actual_model, run:run.run, correct:fields.filter((f)=>f.assessment==='Correct').length, critical_correct:fields.filter((f)=>critical.has(f.key)&&f.assessment==='Correct').length, fields };
    });
    lines.push('', `**${runs.length} real completion POSTs; 0 paid fallbacks; ${aggregate.valid_json_outputs} complete, schema-valid outputs.** ${defaultCount} requests used the original 1,200-token JSON-object request without reasoning controls. ${diagnosticCount} requests used the individually recorded diagnostic/remediation settings. See request_parameters in each results.json for exact budget, reasoning and response-format controls.`, '', 'Every model was checked against the live catalogue for zero input/output/request prices. Requests used provider.require_parameters and a zero-price ceiling. No paid model or model fallback array was sent. Catalogue prices do not audit external BYOK billing; the earlier Google route reported BYOK provider errors. Account settings were unchanged.', '', `Usage receipts: ${aggregate.known_usage_receipts}/${runs.length}; reported input tokens: ${aggregate.known_prompt_tokens}; output tokens: ${aggregate.known_completion_tokens}; reported OpenRouter charge sum: $${aggregate.known_reported_cost_usd}. Missing receipts are unknown charges, not inferred zero. Infrastructure costs are separate. Earlier Liquid reasoning subtotals exceeded completion totals in some receipts; those inconsistencies are preserved.`, '', 'Each experiment directory stores its exact API counters. Earlier discovery outside these directories added one catalogue GET, three Supabase GETs (including one failed relationship probe), and one scraper inspection. All database access was read-only. The saved paid baseline has no latency/token/cost receipt; no fresh paid call was made.', '', '## D. Diagnosis and verdict', '', 'The original output limit included both internal reasoning and visible JSON. Liquid and NVIDIA exhausted that allowance while reasoning, returning content:null with finish_reason:length. This is a request/model compatibility failure, not evidence that the source was inaccessible or that JSON parsing discarded a valid answer. Liquid advertises mandatory reasoning, so disabling it is rejected; NVIDIA advertises optional reasoning.', '', 'A separate failure remained after increasing Liquid to 8,192 tokens: it produced JSON but returned requirements:null (invalid against the actual production array schema) and incorrectly attributed the opportunity to Monash. With NVIDIA reasoning disabled at the original 1,200-token limit, JSON was returned, but JSON-object mode still allowed a requirements:null response. The strict-schema phase therefore sends a JSON Schema converted directly from the production Zod validator, with all 14 fields required and no extra properties. The source and production system prompt remain unchanged. No null array is silently repaired.', '', '| Validated output | Correct fields / 15 | Critical fields / 10 |', '|---|---:|---:|');
    for (const score of scores) lines.push(`| ${score.folder} / ${score.model} / run ${score.run} | ${score.correct} | ${score.critical_correct} |`);
    lines.push('', representative ? '1. **Accurate enough for this opportunity?** Complete outputs now exist; use the per-run field and critical scores above. A schema-valid response alone is not a factual-accuracy guarantee.' : '1. **Accurate enough?** No usable result yet; accuracy is not measurable.', representative ? '2. **Event and link?** The side-by-side table shows the actual normalized event instant and literal YouTube link from the first validated result; all other validated runs are scored above.' : '2. **Event and link?** Not delivered in a schema-valid result.', '3. **Hallucinations/omissions?** Liquid named the wrong organiser, and several complete JSON responses used null for requirements, violating the schema. Inspect every raw output below; failed/empty calls are not treated as hallucination-free.', `4. **Valid JSON/schema?** ${valid.length} complete results passed the production validator. Each failed call is retained, including schema-invalid JSON.`, '5. **Default model?** Do not switch production on evidence from this single event. Free-provider rate limits and observed latency outliers still matter, even with a working request configuration.', '6. **Paid fallback?** Retain the current production model and use bounded fallback only after a broader evaluation. No paid fallback was called in this benchmark.', '7. **Further cases?** Events versus application deadlines, ambiguous/DST timezones, rolling/missing deadlines, fees versus funding, missing/literal URLs, multiple listings, long pages, PDFs/images/voice transcripts, relative dates and missing years; measure latency and quota behavior under concurrency.', '', '## E. Recommended routing strategy (not deployed)', '', '`Catalogue-verified free endpoint + supported reasoning control + production-derived JSON Schema → strict JSON parse → actual production validator → source-based semantic checks → success`', '', '`Empty/truncated/error/timeout/schema/semantic failure → bounded transient retry → paid fallback if enabled`', '', 'Use supported model-specific controls: reasoning.enabled:false on the tested NVIDIA endpoint; a larger explicitly bounded budget for mandatory-reasoning models. Merely hiding reasoning with exclude:true does not save tokens. Strict schema prevents structural errors where supported, but cannot prevent a wrong organiser or invented facts. Do not retry permanent unsupported-parameter errors. Keep latency timeouts and price guards.', '', '## All returned structured outputs', '');
    for (const run of runs.filter((r)=>r.output)) lines.push(`### ${run.folder || 'default'} / ${run.requested_model} / run ${run.run}`, '', `Production schema: ${run.schema_valid ? 'valid' : 'invalid'}; finish reason: ${run.finish_reason}; error: ${run.error || 'none'}.`, '', '```json', JSON.stringify(run.output,null,2), '```', '');
    lines.push('## Reproducibility and scope', '', `Every phase used the same production system prompt and source SHA-256 ${aggregate.source_sha256}. The script captures the production request offline before making verified free API calls. That capture stub never makes an inference request or counts as a result. Request parameters differ only as explicitly labelled. Strict-schema mode uses zod-to-json-schema already installed in this repository to convert the production schema; it does not replace the runtime validator.`, '', 'Source inspection confirmed the live LinkedIn scrape included the full biography, event time, and pinned YouTube URL. The verified fixture isolates those facts from page navigation. Event reference time is the original saved extraction timestamp. The original paid prompt and input are unavailable, so this is a live saved baseline comparison, not an identical-input rerun of the paid model.', '', 'Only the local benchmark script and local reports/receipts changed. No production code, model configuration, environment variables, database rows, deployments, commits or pushes were changed. The initial report is retained as report-initial.md; this report supersedes its no-usable-output conclusion with the remediation results.', '', 'Reproduce NVIDIA strict-schema trials from the repository root:', '', '```sh', "BENCHMARK_FREE_MODELS='nvidia/nemotron-3.5-super-vl:free' BENCHMARK_DISABLE_REASONING=1 BENCHMARK_STRICT_SCHEMA=1 BENCHMARK_REPETITIONS=3 BENCHMARK_OUTPUT_DIR='.local/benchmarks/openrouter-free-opportunity/new-strict-trial' node scripts/benchmark-openrouter-free-opportunity.mjs --no-report", '```', '', 'Regenerate the combined report without API calls: node scripts/benchmark-openrouter-free-opportunity.mjs --report-only', '', 'References: [reasoning/output token budgets](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [zero-price provider caps](https://openrouter.ai/docs/guides/routing/provider-selection).', '');
    await save('comparison.json', { aggregate, validated_run_scores:scores, source_inspection:sourceInspection, fields: comparison, experiments: experiments.map(({folder,metrics,source,request})=>({folder,metrics,source_sha256:source.sha256,temperature:request.temperature,max_tokens:request.max_tokens})) });
    await save('report.md', lines.join('\n'));
    console.log(JSON.stringify({ report:path.join(out,'report.md'), aggregate }));
}
