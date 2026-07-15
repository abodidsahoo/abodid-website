# Media processor

Queue consumer for R2 `object-create` notifications under `originals/`.
It creates permanent 800/1600 WebP variants, stores them back in the `photos`
bucket, and updates the Supabase media catalogue.

The Worker requires two encrypted secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Provision after `wrangler login`:

```sh
npx wrangler queues create personal-site-media-dead-letter
npx wrangler queues create personal-site-media-processing
npx wrangler deploy --config workers/media-processor/wrangler.jsonc
npx wrangler secret put SUPABASE_URL --config workers/media-processor/wrangler.jsonc
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/media-processor/wrangler.jsonc
npx wrangler r2 bucket notification create photos \
  --event-type object-create \
  --prefix originals/ \
  --queue personal-site-media-processing \
  --description "Generate permanent WebP variants for originals"
```

List the bucket notifications before creating the rule when reprovisioning so
the `originals/` rule is not duplicated.
