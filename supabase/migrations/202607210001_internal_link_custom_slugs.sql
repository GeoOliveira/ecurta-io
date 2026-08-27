begin;

create or replace function public.update_internal_link_slug(
  p_link_id uuid,
  p_slug text,
  p_request_id text
) returns table(
  result text,
  link_id uuid,
  slug text,
  link_status public.short_link_status,
  expires_at timestamptz,
  created_at timestamptz,
  last_accessed_at timestamptz,
  click_count bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_link public.short_links%rowtype;
  v_previous_slug text;
begin
  if p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' then
    raise exception 'invalid integration request';
  end if;
  if p_slug !~ '^[A-Za-z0-9]{4,32}$' then
    raise exception 'invalid slug';
  end if;

  select * into v_link
  from public.short_links
  where id=p_link_id and deleted_at is null
  for update;

  if not found then
    return query select 'not_found',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz,null::timestamptz,null::bigint;
    return;
  end if;
  if v_link.integration_source is distinct from 'alcance_ia' then
    return query select 'denied',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz,null::timestamptz,null::bigint;
    return;
  end if;
  if v_link.slug::text=p_slug then
    return query select 'unchanged',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at,v_link.last_accessed_at,v_link.click_count;
    return;
  end if;

  v_previous_slug:=v_link.slug::text;
  update public.short_links
  set slug=p_slug,updated_at=now()
  where id=p_link_id
  returning * into v_link;

  insert into public.audit_logs(action,entity_type,entity_id,before_data,after_data)
  values(
    'integration_link_slug_update',
    'short_link',
    v_link.id,
    jsonb_build_object('slug',v_previous_slug),
    jsonb_build_object('slug',v_link.slug::text,'integration_source','alcance_ia','request_id',p_request_id)
  );

  return query select 'updated',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at,v_link.last_accessed_at,v_link.click_count;
end;
$$;

revoke all on function public.update_internal_link_slug(uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_internal_link_slug(uuid,text,text) to service_role;

create or replace function public.check_and_record_integration_rate_limit_v2(
  p_source text,
  p_endpoint text,
  p_method text,
  p_request_id text,
  p_minute_limit int,
  p_hour_limit int,
  p_day_limit int
)
returns table(allowed boolean,limit_value int,remaining int,reset_at bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_minute int;
  v_hour int;
  v_day int;
begin
  if p_source<>'alcance_ia'
    or p_method not in ('GET','POST','PATCH')
    or p_minute_limit<1
    or p_hour_limit<1
    or p_day_limit<1 then
    raise exception 'invalid rate limit configuration';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_source||':'||p_endpoint));
  select count(*) into v_minute from public.integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 minute';
  select count(*) into v_hour from public.integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 hour';
  select count(*) into v_day from public.integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 day';
  if v_minute>=p_minute_limit then
    return query select false,p_minute_limit,0,extract(epoch from now()+interval '1 minute')::bigint;
    return;
  end if;
  if v_hour>=p_hour_limit then
    return query select false,p_hour_limit,0,extract(epoch from now()+interval '1 hour')::bigint;
    return;
  end if;
  if v_day>=p_day_limit then
    return query select false,p_day_limit,0,extract(epoch from now()+interval '1 day')::bigint;
    return;
  end if;
  insert into public.integration_api_events(integration_source,request_id,endpoint,method,status_code,action)
  values(p_source,p_request_id,p_endpoint,p_method,0,'request_received');
  return query select true,p_minute_limit,greatest(0,p_minute_limit-v_minute-1),extract(epoch from now()+interval '1 minute')::bigint;
end;
$$;

revoke all on function public.check_and_record_integration_rate_limit_v2(text,text,text,text,int,int,int) from public,anon,authenticated;
grant execute on function public.check_and_record_integration_rate_limit_v2(text,text,text,text,int,int,int) to service_role;

commit;
