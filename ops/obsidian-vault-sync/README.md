# Obsidian vault automatic sync

These two files are installed in the private `abodidsahoo/obsidian-vault`
repository as:

- `.github/workflows/sync-vault-to-supabase.yml`
- `.github/scripts/sync-supabase.mjs`

Every push to `main` that changes a Markdown note sends the complete note set
to the narrowly authenticated `sync-obsidian-vault` Supabase Edge Function.
The function compares Git blob hashes, updates only changed note rows and
embeddings, and removes notes deleted from the source repository.

GitHub stores only `VAULT_SYNC_SECRET`. Supabase retains the service-role and
OpenRouter credentials, so the vault repository never receives broad database
or model access.
