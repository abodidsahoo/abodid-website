-- Embeddings created before private relationship fields were added need to be
-- rebuilt once so existing outreach goals and notes can influence semantic search.
update public.network_contacts
set embedding_refresh_needed = true
where
  coalesce(cardinality(outreach_goals), 0) > 0
  or nullif(btrim(notes), '') is not null;
