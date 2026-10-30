-- Apply only after the server inserts verified capture jobs via service_role.
begin;
-- Only the API's verified user may enqueue work; a raw Data API insert must
-- not bypass input validation or the API's rejection of anonymous identities.
revoke insert on public.opportunity_capture_jobs from authenticated;
drop policy if exists "Owners can create capture jobs" on public.opportunity_capture_jobs;

commit;
