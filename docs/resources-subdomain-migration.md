# Future Extraction: Migration to Subdomain

This guide outlines the steps to extract the Resources Hub (`/resources`) from the main personal site into a standalone application (e.g., `resources.abodid.com`).

## Why Extract?
- **Isolation**: Separate dependencies and deploy cycles.
- **Performance**: Distinct build pipeline; edge optimization.
- **Scaling**: Easier to move to a dedicated database or backend if needed.

## Migration Steps

### 1. Monorepo Restructuring
If not already in a monorepo, move the current site to `apps/web` and create `apps/hub`.
- Move `src/pages/resources` content to `apps/hub/src/pages/index.astro` (and children).
- Move `src/lib/resources` to a shared package `packages/db` or copy to `apps/hub/src/lib`.
- Move `src/components/resources` to `apps/hub/src/components`.

### 2. Vercel Configuration
1. Create a new Project in Vercel.
2. Link it to the same Git repository.
3. **Important**: Set the **Root Directory** to `apps/hub` (or wherever you moved the code).
4. Add the `resources.abodid.com` domain to this new project.

### 3. Database & Auth
Since both apps share the same Supabase project:
1. Go to **Supabase Dashboard > Authentication > URL Configuration**.
2. Add `https://resources.abodid.com/**` to the **Redirect URLs**.
3. Ensure Cookies work across subdomains if you want shared login (set cookie domain to `.abodid.com` in Supabase client config).

### 4. Redirects (Main Site)
Update the main site's `vercel.json` or `astro.config.mjs` to redirect traffic:

```json
{
  "redirects": [
    {
      "source": "/resources",
      "destination": "https://resources.abodid.com",
      "permanent": true
    },
    {
      "source": "/resources/:path*",
      "destination": "https://resources.abodid.com/:path*",
      "permanent": true
    }
  ]
}
```

### 5. Cleanup
- Remove `src/pages/resources` from the main site.
- Keep `src/lib/resources` only if used by other parts (e.g., generic components), otherwise move to the new app.
