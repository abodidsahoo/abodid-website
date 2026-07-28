# Network Intelligence admin

Private, owner-only workspace for exploring the LinkedIn Connections export at:

- `/admin/network`
- `/admin/dashboard?section=network_intelligence`

## Architecture

`network_contacts` is the primary contact record. It preserves the original CSV
snapshot and source fields beside editable working fields, consent state, public
evidence, custom fields, and the 1,536-dimension semantic embedding.
`network_import_runs` is a small audit table for import reports.

All reads and writes are protected by owner-scoped Supabase RLS. Anonymous access
is revoked. Service-role RPCs handle hybrid search, facets, and embedding updates
without returning raw snapshots or vectors to the browser.

The interface renders a bounded server-side result window so the 10k-contact
dataset stays responsive. Instant search uses indexed Postgres text search;
Smart Search combines keyword rank, vector similarity, structured filters, and
short match reasons. Public web discovery runs only when explicitly requested
from an individual contact and presents cited candidates for review; it never
silently merges a result.

## Source reconciliation

The supplied `Connections.csv` contains 10,298 data rows:

- 10,047 importable contacts with canonical LinkedIn profile URLs
- 254 source email addresses
- 0 duplicate profile URLs
- 251 rows without identity fields; retained in the import error report rather
  than converted into invented contacts

Newsletter status defaults to `not_subscribed`; source email presence does not
imply consent.

## Configuration

The feature uses the existing server-only Supabase and OpenRouter variables:

```dotenv
PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_NETWORK_MODELS=openrouter/auto,google/gemini-2.5-flash,openai/gpt-4.1-mini
OPENROUTER_NETWORK_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_NETWORK_BATCH_SIZE=64
OPENROUTER_NETWORK_BATCH_DELAY_MS=120
```

Apply `supabase/migrations/20260726143000_create_network_intelligence_admin.sql`
through the normal migration workflow. For a local or repeatable CSV sync:

```sh
node scripts/import-linkedin-network.mjs /absolute/path/Connections.csv --dry-run
node scripts/import-linkedin-network.mjs /absolute/path/Connections.csv
node scripts/import-linkedin-network.mjs /absolute/path/Connections.csv --embed-only
```

Imports upsert on `owner_id + source_record_key`, distinguish inserted, updated,
unchanged, failed, and duplicate rows, and are safe to resume. Semantic indexing
also resumes from only the contacts marked as needing refresh.

If a future export uses different headers, the import preview opens an explicit
seven-field mapping step. Source changes flow into current fields only when those
fields still follow the prior source value; manual corrections are preserved and
the incoming difference appears in the contact's Source data tab.

## Intentional boundaries

- No LinkedIn scraping, authenticated-page automation, or profile guessing.
- Current employment and location remain unknown when the export does not provide
  them; reviewed public evidence or manual edits can enrich those fields.
- Email and newsletter consent remain separate.
- Raw source values are retained for traceability instead of overwritten.

## Remaining limitations

The LinkedIn export does not contain a reliable location, interaction history, or
confirmed-current employment record, so those fields remain unknown until
manually edited or supported by accepted public evidence. Web discovery quality
depends on publicly indexed sources and always requires review. The feature is
implemented in the local worktree and connected Supabase project; the production
route becomes available through the site's normal deployment workflow.
