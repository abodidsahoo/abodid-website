-- An approved artist profile can be published with approximate country placement.
-- Location verification and publication approval remain independent; source
-- coordinates, verification flags, range checks and published-only RLS stay intact.
ALTER TABLE public.art_globe_artists
  DROP CONSTRAINT IF EXISTS art_globe_published_location,
  ADD CONSTRAINT art_globe_published_location CHECK (
    NOT published OR (
      nomination_status IN ('curated', 'approved')
      AND (
        (latitude IS NOT NULL AND longitude IS NOT NULL)
        OR (country IS NOT NULL AND length(btrim(country)) > 0)
      )
    )
  );
