# Lab routing and repository structure

The Lab has one canonical experiment collection at `https://abodid.com/lab`.
The separate `https://lab.abodid.com` homepage is an editorial introduction
that sends visitors to the canonical experiment URLs.

## Public pages

- `/lab` — experiment index on the main site.
- `/lab/punctum` — Punctum and its `experiment`, `results`, and `about` routes.
- `/lab/image-flick` — gesture-controlled image stack.
- `/lab/photo-board` — interactive Polaroid-style photo board.

## Source layout

```text
src/
  components/lab/       Shared Lab index and subdomain presentation
  data/labExperiments.ts  Single catalogue for titles, descriptions, links, and thumbnails
  pages/lab/             Canonical public experiment pages
    punctum/
    image-flick/
    photo-board/
  pages/api/punctum/     Server endpoints used by the Punctum experience
  lib/punctum/           Punctum domain logic and OpenRouter/Gemini providers
```

The experiment page files were physically moved out of `src/pages/research/`
and into `src/pages/lab/`. API files remain under `src/pages/api/` by design:
they are shared server infrastructure rather than public pages, and keeping them
there preserves the existing `/api/punctum/*` calls.

## Subdomain routing

`vercel.json` rewrites the root request for `lab.abodid.com` to the Lab route.
The route detects that hostname and renders the editorial subdomain view. On
`abodid.com/lab`, it renders the direct experiment index. Both views read the
same catalogue, so their cards cannot drift apart.

Punctum image generation already uses the OpenRouter provider whenever
`OPENROUTER_API_KEY` is available. Its provider selection and environment
variables remain unchanged during the page migration.
