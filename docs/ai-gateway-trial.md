# Reversible AI Gateway trial

Tested 29 October 2026. This is a local server-side experiment, not a deployed provider migration.

## Results

| Check | Observed result | Limit of the result |
| --- | --- | --- |
| Authentication | Gemini 2.5 Flash returned `gateway trial ready`; HTTP 200 | Confirms the trial key and endpoint work |
| Moodboard | 30 lowercase tags in 3.62 seconds; $0.0016074 reported usage | Technical success; editorial quality needs correction; no tags saved |
| Opportunity | Synthetic fellowship extracted in 1.73 seconds; $0.0012274 reported usage; saved and read back | Server-side service and database tested; browser login, extension capture and external webpage scraping were not tested |
| Opportunity cleanup | Exact synthetic row deleted and absence verified; zero reminders | Existing opportunities unchanged |
| Vault through Gateway | HTTP 403 for `openai/text-embedding-3-small` | This account's free tier cannot access this model |
| Vault through existing OpenRouter | Six public chunks returned using 1,536-dimensional embeddings and vector search alone | One query, relevance reviewed manually; no index or note changes; OpenRouter cost not captured by the existing helper |

Reported Gateway total including the $0.0000093 connection check: **$0.0028441**. Usage already incurred is not reversible. No credits were purchased and no auto top-up was enabled.

### Tag quality review

Image: `0bf62bae-1e22-404b-8935-2b787db262d0`, a pink invitation beside a transparent bag of yarn, with a small photograph of people gathered around a table.

Unedited output:

> pink background, black background, flyer, plastic bag, yarn, red yarn, white yarn, pink yarn, hand, white shirt, typography, event invitation, gathering, community, text, copenhagen, recycled yarn, reduce, reuse, recycle, the common thread club, people, indoor, table, social event, crafting, warm lighting, dark background, bright foreground, duotone

Useful literal hooks include `yarn`, `plastic bag`, `hand`, `typography`, `table` and `people`. The result repeats black/dark background and gathering/social event. `duotone` is inaccurate for the full-colour composite. It misses useful visible design properties such as serif type, sans serif type, transparency and creased paper. Copenhagen and recycling are printed on the design; they are source context, not proof of where the photograph was captured or how its materials were manufactured. This sample is **not approved for automatic tagging rollout**.

The governing methodology remains [Abodid's Master Tag Builder](../public/docs/ABODID_MASTER_TAG_BUILDER.md), v1.2.0. Existing runtime code still labels its prompt v1.1.0 and uses OpenRouter, despite the document specifying direct OpenAI as the production default. This trial explicitly used Gemini through Gateway without changing that default or the methodology document.

### Opportunity check

The synthetic source stated a fellowship deadline of **15 November 2026, 5 pm IST**. Extraction returned `2026-11-15T17:00:00+05:30`, and database readback confirmed `2026-11-15T11:30:00+00:00`. It preserved the application URL, portfolio and 300-word proposal requirements, INR 10,000 funding and explicit no-application-fee statement. The trial used the existing extraction prompt, validation schema and `createOpportunityFromPayload` save service. The database client was a server-side service client, so this does not establish browser authentication/RLS behavior.

### Semantic query

Question: **How can uncertainty and not knowing support creative research?**

| Returned note title (as stored) | Similarity |
| --- | --- |
| inserting artisitc unpredictablity to rewild ai | 0.477 |
| knowledge as a fossil | 0.471 |
| everything is research | 0.461 |
| excited curiosity | 0.449 |
| irrational reverence for scientific reductionism | 0.446 |
| excited curiosity (another chunk) | 0.442 |

These are cosine similarity scores, not probabilities or confidence percentages. The excerpts concern uncertainty, creative inquiry and curiosity, so the results are useful for this query. The test called the existing public-only vector RPC; no keyword fallback or answer generation was used.

## Step-by-step process

1. **Keep the current site running.** This trial adds only a script, this guide and an ignored secret file. Application source, hosting environment variables and production deployments are unchanged. Existing unrelated working-tree edits are preserved.
2. **Use a separate Gateway key.** The key created for this run is named `moodboard-gateway-trial-2026-10-29`, has a $1 nonrenewing budget and expires after seven days. Its value is in `.env.gateway-trial.local`, ignored by Git with file permissions 0600. Do not copy it into frontend code or chat. For a future run, create a new key under AI Gateway → API Keys, use a small budget and expiry, and store only `AI_GATEWAY_API_KEY=<key>` in that local file. A budget is checked before requests, so it can be exceeded slightly by a final in-flight request; keep requests small and sequential.
3. **Confirm access first.** Send one short Chat Completions request. The screenshot's `moonshotai/kimi-k3` is an example; its presence in a snippet does not establish free-tier eligibility. This account successfully used `google/gemini-2.5-flash`.
4. **Generate tags without saving.** Read one existing moodboard image and a compact vocabulary sample, apply the existing Master prompt and normalization, preview the result, and verify its stored tags and timestamp are unchanged. The script's `passed` state covers transport/format/data protection; review artistic quality separately.
5. **Test a disposable opportunity.** Extract a clearly synthetic fixture, validate it, save it to the verified founder account with empty reminder offsets, read it back, check the timezone and zero reminders, delete it, then verify absence. The record may briefly appear in the account during the test; its title begins `[Gateway trial]`.
6. **Test semantic retrieval without rebuilding the vault.** Keep `openai/text-embedding-3-small` at 1,536 dimensions. Try Gateway, record the observed free-tier denial, then explicitly run the existing OpenRouter baseline. Never substitute an embedding model merely because its dimensions match: different embedding models use different vector spaces.
7. **Review before rollout.** Decide separately whether tags are good enough, whether real page capture works in the browser, and whether to retain OpenRouter embeddings. A possible later architecture is Gateway for selected generation tasks with existing OpenRouter embeddings. That architecture has not been implemented by this experiment.

## Repeat the checks

From the repository root, print usage without making API requests:

```sh
node scripts/trial-ai-gateway.mjs
```

Each online command below incurs model usage. Full trial, with one automatic cleanup of the synthetic opportunity:

```sh
node scripts/trial-ai-gateway.mjs --run
```

Run only one workflow:

```sh
node scripts/trial-ai-gateway.mjs --run --only=moodboard
node scripts/trial-ai-gateway.mjs --run --only=opportunity
node scripts/trial-ai-gateway.mjs --run --only=vault
```

Explicitly test the existing embedding provider (does not need the Gateway secret file):

```sh
node scripts/trial-ai-gateway.mjs --run --only=vault --vault-provider=openrouter
```

Every run writes its results into a fresh `personal-site-gateway-trial-*` temporary directory and prints the exact path. Reports are local, with restricted permissions. There are no automatic provider fallbacks or retries. The full trial exits nonzero when Gateway denies the embedding request; inspect per-stage results rather than interpreting that as failure of the successful stages.

## Rollback

1. **Revoke the trial key** in AI Gateway → API Keys, selecting its exact name. Alternatively, the following command targets only the key created for this run:

   ```sh
   npx --yes vercel@latest ai-gateway api-keys revoke 7p93EQnnLl638hYzGe3q50Zka8T4Vptt4FdF53W8VwayJh3I --yes --scope abodid-sahoos-projects
   ```

2. Delete only `.env.gateway-trial.local` if retiring the experiment. Leave existing `.env`, `.env.local`, and OpenRouter configuration intact.
3. No data rollback is needed after the completed run: image tags and vault vectors were never written; the synthetic opportunity was deleted and absence verified.
4. If a future run is interrupted during the save, use that run's `opportunity-cleanup.json`. Match its exact owner and unique canonical URL, plus the `[Gateway trial]` notes marker, before deleting the synthetic row. Never use a broad title-prefix deletion. The script's `finally` block performs this cleanup on ordinary errors, but a killed process or lost connection may require manual cleanup.
5. To remove the local experiment code, remove only `scripts/trial-ai-gateway.mjs` and this guide. Do not reset the working tree; other work was already present before the trial.

The live site needs no redeploy to return to its prior behavior because its routing was never changed. Rollback cannot undo consumed credits or erase requests already sent to providers.

## References

- [Vercel Gateway pricing and free-tier restrictions](https://vercel.com/docs/ai-gateway/pricing)
- [Gateway API keys](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys)
- [Gateway budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets)
- [Chat Completions and embeddings endpoints](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions)

Validation: script syntax check, online checks above, and 54 existing moodboard/opportunity tests passed. The trial does not claim to have tested production browser flows or completed a provider migration.
