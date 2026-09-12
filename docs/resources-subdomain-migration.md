# Curation subdomain architecture

The Resources product is published as **Curation by Abodid** at
`https://curation.abodid.com`. Its old `/resources` namespace remains in the
Astro source only as an internal implementation path.

## Public application routes

- `/` — resource catalogue
- `/resource/:id` — resource detail
- `/resource/:id/edit` — resource editor
- `/submit`, `/saved`, and `/dashboard` — signed-in curator workflows
- `/admin`, `/admin/review`, `/admin/analytics`, and `/admin/users` — Curation
  administration
- `/u/:username` — public curator profile
- `/login` and `/auth/callback` — shared authentication routes
- `/robots.txt` and `/sitemap.xml` — Curation-only discovery files

The personal Site Workspace is separate: it remains at
`https://abodid.com/admin/dashboard`. Curation's `/admin` must never be rewritten
to the personal workspace, and the personal workspace must never be routed into
Curation or the Obsidian vault.

## How routing works

`middleware.js` is Vercel Routing Middleware. It runs before the filesystem and
maps Curation's public paths to the existing internal `/resources` pages. It
also permanently redirects old `abodid.com/resources/*` links to their public
Curation equivalents.

`src/middleware.ts` remains Astro response middleware. It handles trailing-slash
normalization and cache policy, but it does not perform hostname routing.
`vercel.json` contains only platform-wide settings and the stable legacy
Obsidian-vault redirects. There must not be a second set of Curation or Lab host
rewrites there.

## Deployment requirements

- `abodid.com`, `www.abodid.com`, `curation.abodid.com`, and `lab.abodid.com`
  must point to the same Vercel project while these products share one build.
- Supabase's allowed redirect URLs must include the exact Curation auth callback
  and reset-password destinations used by the application.
- Production environment variables must contain real values. Redacted values
  pulled into `.vercel/.env.production.local` are suitable for inspection but
  cannot be used for a local production build.
- After a production deployment, verify all canonical and legacy URLs before
  changing DNS or deleting internal source routes.
