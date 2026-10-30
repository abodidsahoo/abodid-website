begin;
-- Hold the membership row while deriving and saving the new value. Two
-- administrators adding five concurrently must produce ten extra attempts.
create function public.increment_opportunity_ai_allowance(
 p_user_id uuid,p_admin_id uuid,p_increment integer,p_default_limit integer default 5
) returns integer language plpgsql security definer set search_path = '' as $$
declare current_limit integer; next_limit integer;
begin
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_increment is null or p_increment not in (5,10) or p_default_limit is null or p_default_limit not between 0 and 10000 then
  raise exception 'Invalid allowance increment' using errcode='22023';
 end if;
 select coalesce(ai_monthly_limit,p_default_limit) into current_limit
 from public.opportunity_memberships where user_id=p_user_id for update;
 if not found then raise exception 'Tracker user not found' using errcode='P0002'; end if;
 next_limit:=current_limit+p_increment;
 if next_limit>10000 then raise exception 'Monthly allowance cannot exceed 10000' using errcode='22023'; end if;
 perform public.set_opportunity_ai_allowance(p_user_id,p_admin_id,next_limit);
 return next_limit;
end; $$;
revoke all on function public.increment_opportunity_ai_allowance(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.increment_opportunity_ai_allowance(uuid,uuid,integer,integer) to service_role;
create function public.confirm_opportunity_ai_allowance(
 p_user_id uuid,p_admin_id uuid,p_expected_limit integer,p_default_limit integer default 5,
 p_increment integer default null,p_limit integer default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare current_limit integer; next_limit integer;
begin
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_expected_limit is null or p_expected_limit not between 0 and 10000 or p_default_limit is null or p_default_limit not between 0 and 10000
 or (p_increment is null)=(p_limit is null) then raise exception 'Invalid confirmed update' using errcode='22023'; end if;
 select coalesce(ai_monthly_limit,p_default_limit) into current_limit from public.opportunity_memberships where user_id=p_user_id for update;
 if not found then raise exception 'Tracker user not found' using errcode='P0002'; end if;
 if current_limit<>p_expected_limit then raise exception 'Allowance changed. Refresh and review again.' using errcode='40001'; end if;
 if p_increment is not null then return public.increment_opportunity_ai_allowance(p_user_id,p_admin_id,p_increment,p_default_limit); end if;
 if p_limit not between 0 and 10000 then raise exception 'Invalid allowance' using errcode='22023'; end if;
 perform public.set_opportunity_ai_allowance(p_user_id,p_admin_id,p_limit);
 return p_limit;
end; $$;
revoke all on function public.confirm_opportunity_ai_allowance(uuid,uuid,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.confirm_opportunity_ai_allowance(uuid,uuid,integer,integer,integer,integer) to service_role;

create function public.opportunity_ai_usage_summary(p_user_id uuid default null)
returns table(user_id uuid,used_month bigint,total_attempts bigint)
language sql stable security definer set search_path = '' as $$
 select u.user_id,sum(case when u.month_start=date_trunc('month',now() at time zone 'UTC')::date then u.captures else 0 end)::bigint,sum(u.captures)::bigint
 from public.opportunity_ai_usage u where p_user_id is null or u.user_id=p_user_id group by u.user_id;
$$;
revoke all on function public.opportunity_ai_usage_summary(uuid) from public,anon,authenticated;
grant execute on function public.opportunity_ai_usage_summary(uuid) to service_role;
commit;
