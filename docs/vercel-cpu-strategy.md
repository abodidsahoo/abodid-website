# Vercel Fluid CPU reduction strategy

This project is intentionally optimized for a low-traffic personal site. The CPU budget is protected at three layers so ordinary page views, idle background checks, and automated traffic do not reach Vercel Functions unnecessarily.

## 1. Do not wake Vercel when background queues are idle

Production migration `20261024180338_gate_opportunity_cron_http_calls.sql` keeps the one-minute recovery guarantees for opportunity capture, Telegram delivery, cleanup, and reminders, but evaluates readiness in Supabase first. The two cron jobs call Vercel only when a job can actually be claimed.

At idle this removes up to 2,880 function requests per day, or 86,400 per 30-day month, while retaining the existing retry and stale-lease recovery behavior.

## 2. Serve fixed public surfaces as static files

Fixed public and archive routes that do not require per-request identity are prerendered during deployment. Vercel can serve those files from its CDN without starting the Astro server function. Authenticated pages, APIs, previews, and routes whose result truly depends on request-time state remain server-rendered.

The moodboard keeps its static HTML and fetches current tag metadata directly
from a public Supabase Storage JSON file. A change-driven Supabase publisher
updates it; public searches do not invoke Vercel or query the database. See
[moodboard search publication](./moodboard-search-publication.md).

PDF parsing and FFmpeg discovery in opportunity capture are also dynamically loaded. Normal URL, pasted-text, and image captures therefore avoid initializing those heavy modules.

## 3. Reject automated noise at the edge

The production Vercel Firewall has Bot Protection in challenge mode, denies encoded garbage-path probes, and retains the managed AI-bot deny rule. Only trusted integration namespaces bypass the browser challenge:

- `/api/opportunities` for the signed dashboard, extension, cron, and capture flows.
- `/api/integrations` for authenticated webhook integrations.

Other APIs remain behind bot protection, so scanners and scripted probes are stopped before they can consume function CPU. Real browsers continue to work normally.

## Operational guardrails

- Keep scheduled readiness checks in Supabase rather than adding Vercel Cron jobs that wake a function unconditionally.
- Add `export const prerender = false` only when a page genuinely needs request-time cookies, authentication, redirects, or fresh per-request data.
- Keep heavyweight optional processors behind dynamic imports.
- Review Vercel Usage after the prior rolling-window usage ages out. The changes prevent new avoidable CPU consumption; they do not erase already-recorded usage.
- If unexplained CPU returns, use Vercel Observability to identify the route before changing behavior. Preserve the narrow integration bypass instead of bypassing `/api/` broadly.
