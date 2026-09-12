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

Vercel applies the hostname redirects in `vercel.json` before filesystem or
Astro route resolution. `src/middleware.ts` remains in Astro's normal Node
rendering request and handles:

1. **Subdomain fallback routing** — preserves the same redirects during local
   development or if a hostname request reaches Astro directly.
2. **Trailing-slash normalization** — strips trailing slashes with a 308 redirect.
3. **Cache policy** — sets appropriate `Cache-Control` and `Vercel-CDN-Cache-Control`
   headers for public vs. private pages.

> **Note:** The root `middleware.js` file is a legacy Vercel Routing Middleware
> file that is **not executed** in production. Vercel ignores it for Astro
> projects because `@astrojs/vercel` builds its own routing config. The file is
> kept as reference only.

`vercel.json` is the production source of truth for Lab, Curation, and
Photography hostname redirects as well as stable legacy-path redirects. Do not
re-enable the adapter's edge-middleware mode: it proxies dynamic routes through
a shared `/_render` URL and can collapse unrelated cache entries.

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
