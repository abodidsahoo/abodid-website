# Lab routing and repository structure

The Lab's canonical origin is `https://lab.abodid.com`. The `/lab` namespace in
the Astro source is an implementation detail; it is not part of the public URL.

## Public pages

- `https://lab.abodid.com/` — Lab homepage and experiment index.
- `https://lab.abodid.com/punctum` — Punctum and its `experiment`, `results`,
  and `about` routes.
- `https://lab.abodid.com/image-flick` — gesture-controlled image stack.
- `https://lab.abodid.com/photo-board` — interactive Polaroid-style photo board.
- `https://lab.abodid.com/robots.txt` and `/sitemap.xml` — Lab-only discovery
  files.

Requests to `abodid.com/lab/*` and the older `/research/*` experiment URLs are
permanently redirected to these canonical Lab URLs.

## Source layout

```text
middleware.js             Host routing that runs before Vercel's filesystem
src/
  components/lab/         Lab homepage and experiment catalogue
  data/labExperiments.ts  Single catalogue for experiment metadata
  pages/lab/              Internal Astro route namespace
    punctum/
    image-flick/
    photo-board/
  pages/lab-robots.txt.ts
  pages/lab-sitemap.xml.ts
  pages/api/punctum/       Shared server endpoints used by Punctum
  lib/labRoutes.js         Public/internal URL mappings and redirects
```

Vercel Routing Middleware rewrites public Lab URLs to the internal `/lab`
pages. Astro middleware is deliberately not used for hostname rewrites because
static files are resolved before Astro's on-demand middleware. This separation
also prevents a main-site or vault page from being served under the Lab host.

Punctum image generation continues to use the OpenRouter provider whenever
`OPENROUTER_API_KEY` is available. Its provider configuration was not changed by
the migration repair.
