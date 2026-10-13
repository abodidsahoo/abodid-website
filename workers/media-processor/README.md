# Media processor

Queue consumer for R2 `object-create` notifications under `photos/originals/`.
It creates permanent 800/1600 WebP variants, stores them back in the `assets`
bucket, and updates the Supabase media catalogue. GIF uploads stay animated but
are delivered as compressed animated WebP variants.

Both variant records and files are created for every supported original. Images
smaller than a target width use `scale-down`, so they are compressed into both
variant folders without being enlarged.

The main moodboard uses the 800px record in the masonry grid and the 1600px
record in the opened viewer, falling back to the original only while a variant
is unavailable.

Vercel upload routes only validate and catalogue the original. The R2
notification queue is the authoritative resize and palette path, so uploads
return without spending Vercel CPU on image decoding or the 800/1600
transforms. For moodboard originals, Cloudflare creates a temporary 100x100 PNG
in memory, extracts the palette, stores only the palette JSON in Supabase, and
discards the sample. If Cloudflare processing is temporarily unavailable, set
`MEDIA_VARIANT_PROCESSOR=vercel` on Vercel to restore the synchronous Sharp
fallback; leave it unset for normal Cloudflare processing.

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
