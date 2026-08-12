# Reading digest dashboard

Private Next.js control surface for the daily reading digest. See [`../../docs/reading-digest.md`](../../docs/reading-digest.md) for setup, deployment and operational details.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Vercel injects `SUPABASE_SERVICE_ROLE_KEY` into server-side runtime code. Keep
that exact name and never add a `NEXT_PUBLIC_` prefix. To run the diagnostic
against the linked project's production environment without saving the secret
locally, run from this directory:

```bash
npm run check:reading-digest-runs:vercel
```

This uses `npx`, so a globally installed Vercel CLI is not required. The
diagnostic reads `SUPABASE_SERVICE_ROLE_KEY` only at runtime and does not print
it. It resolves the project URL from `NEXT_PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_URL`, or `SUPABASE_URL`.
