# Lab routing and repository structure

The Lab's canonical origin is `https://lab.abodid.com`. The `/lab` namespace in
the Astro source is an implementation detail; it is not part of the public URL.

## Public pages

- `https://lab.abodid.com/` — Lab homepage and experiment index.
- `https://lab.abodid.com/punctum` — Punctum and its `experiment`, `results`,
  and `about` routes.
- `https://lab.abodid.com/image-flick` — gesture-controlled image stack.
- `https://lab.abodid.com/sequence-room` — interactive Polaroid-style sequence room.
- `https://lab.abodid.com/robots.txt` and `/sitemap.xml` — Lab-only discovery
  files.

Requests to `abodid.com/lab/*` and the older `/research/*` experiment URLs are
permanently redirected to these canonical Lab URLs.

## Source layout

```text
src/
  middleware.ts           Host routing deployed ahead of Vercel's filesystem
  components/lab/         Lab homepage and experiment catalogue
  data/labExperiments.ts  Single catalogue for experiment metadata
  pages/lab/              Internal Astro route namespace
    punctum/
    image-flick/
    sequence-room/
  pages/lab-robots.txt.ts
  pages/lab-sitemap.xml.ts
  pages/api/punctum/       Shared server endpoints used by Punctum
  lib/labRoutes.js         Public/internal URL mappings and redirects
```

Vercel applies the hostname redirects in `vercel.json` before filesystem or
Astro route resolution. Requests for `lab.abodid.com/*` move permanently to the
matching `abodid.com/lab/*` URL. Astro middleware intentionally stays in the
normal Node rendering request so unrelated dynamic responses cannot share a
second internal edge-renderer cache key.

Main-site navigation routes such as `/research`, `/work`, `/photography`, and
`/about` still leave the Lab and redirect to the matching path on `abodid.com`.
Shared assets and API routes also keep their root paths during the redirect.

Punctum image generation continues to use the OpenRouter provider whenever
`OPENROUTER_API_KEY` is available. Its provider configuration was not changed by
the migration repair.
