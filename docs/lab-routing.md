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
src/
  middleware.ts           Host routing deployed ahead of Vercel's filesystem
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

The Vercel adapter deploys Astro middleware at the edge so hostname routing runs
before static-file resolution. It rewrites public Lab URLs to the internal
`/lab` pages while leaving the browser URL untouched. The mapping is generic:
every route added below `src/pages/lab` is automatically available at the same
path on `lab.abodid.com`, without maintaining a project allowlist.

Main-site navigation routes such as `/research`, `/work`, `/photography`, and
`/about` still leave the Lab and redirect to `abodid.com`. Shared assets and API
routes keep their root paths on both hosts.

Punctum image generation continues to use the OpenRouter provider whenever
`OPENROUTER_API_KEY` is available. Its provider configuration was not changed by
the migration repair.
