# Moodboard source URL recovery

The moodboard capture extension stores source URLs for new captures. Historical
rows created before that feature can be recovered conservatively from the local
Chrome history belonging to the profile where **Send to Moodboard** is installed.

The recovery command never modifies Chrome. It copies the live `History` SQLite
database and its WAL files to a temporary directory, reads the snapshot, and
matches rows using several independent signals:

- numeric page or project IDs embedded in both the stored image filename and a
  visited page URL;
- an exact image filename plus Chrome's recorded referrer chain, or an
  immediately preceding source page when the image visit happened within one
  hour of the upload;
- distinctive title or URL words corroborated by the upload time;
- a unique, specific content page inside a 30-second upload window. Specific
  Instagram and Behance posts, plus clusters where multiple images share the
  same nearby source, are promoted to the default apply threshold.
  Uncorroborated one-off candidates remain below it.

Internal pages, authentication URLs, search pages, the Abodid admin, asset CDN
URLs, and generic home/feed pages are never written as sources. Tracking
parameters are removed from recovered URLs.

## Audit first

```sh
npm run backfill:moodboard-sources -- \
  --report=/tmp/moodboard-source-backfill.json
```

The default confidence threshold is `0.98`. The command prints only aggregate
counts; the optional JSON report contains the matched moodboard IDs, filenames,
canonical source URLs, timestamps, confidence, and the evidence used.

## Apply verified matches

```sh
npm run backfill:moodboard-sources -- \
  --apply \
  --report=/tmp/moodboard-source-backfill-applied.json
```

Updates are conditional: a row is changed only while `source_url` is still
`NULL`, so a source added manually or by a concurrent upload is never
overwritten. Re-running the command is safe.

Chrome history has a finite retention window. Rows older than the oldest local
history entry, and images whose source page never produced a specific URL in
history, remain untouched. Those need manual attribution or separate reverse
image research rather than a low-confidence automatic guess.

