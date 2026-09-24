# Media processor

Queue consumer for R2 `object-create` notifications under `photos/originals/`.
It creates permanent 800/1600 WebP variants, stores them back in the `assets`
bucket, and updates the Supabase media catalogue.

Both variant records and files are created for every supported original. Images
smaller than a target width use `scale-down`, so they are compressed into both
variant folders without being enlarged.

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
npx wrangler r2 bucket notification create assets \
  --event-type object-create \
  --prefix photos/originals/ \
  --queue personal-site-media-processing \
  --description "Generate permanent WebP variants for originals"
```

List the bucket notifications before creating the rule when reprovisioning so
the `photos/originals/` rule is not duplicated.
