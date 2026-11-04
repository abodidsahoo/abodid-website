-- Anonymous Auth accounts share the authenticated Postgres role. Require a
-- permanent admin account explicitly as well as the existing admin-role check.
alter policy media_library_hidden_folders_admin_all
    on public.media_library_hidden_folders
    using (
        (select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false
        and public.media_assets_is_admin()
    )
    with check (
        (select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false
        and public.media_assets_is_admin()
    );
