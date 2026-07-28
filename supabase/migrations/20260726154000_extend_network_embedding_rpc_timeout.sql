alter function public.update_network_contact_embeddings(uuid, jsonb)
set statement_timeout to '45s';

comment on function public.update_network_contact_embeddings(uuid, jsonb) is
  'Service-only resumable embedding updates with a scoped timeout for HNSW index maintenance.';
