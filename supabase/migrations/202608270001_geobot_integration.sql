-- Geobot uses independent RPCs and source-scoped idempotency/rate/ownership.
-- No existing Alcance function or data is modified.
begin;

create or replace function public.create_geobot_whatsapp_short_link(
  p_request_id text,
  p_payload_hash text,
  p_slug text,
  p_destination_url text,
  p_expires_at timestamptz,
  p_external_user_id text,
  p_external_resource_id text,
  p_metadata jsonb default '{}'::jsonb
) returns table(result text,link_id uuid,slug text,link_status public.short_link_status,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
  v_request_id uuid;
  v_existing public.integration_requests%rowtype;
  v_link public.short_links%rowtype;
begin
  if p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' or p_payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid integration request'; end if;
  if p_slug !~ '^[A-Za-z0-9]{4,32}$' or p_destination_url !~ '^https://wa\.me/[0-9]+(\?.*)?$' then raise exception 'invalid link data'; end if;
  insert into integration_requests(integration_source,request_id,payload_hash)
  values('geobot',p_request_id,p_payload_hash)
  on conflict(integration_source,request_id) do nothing returning id into v_request_id;
  if v_request_id is null then
    select * into v_existing from integration_requests where integration_source='geobot' and request_id=p_request_id for update;
    if v_existing.payload_hash<>p_payload_hash then return query select 'conflict',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    if v_existing.short_link_id is null then return query select 'processing',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    select * into v_link from short_links where id=v_existing.short_link_id;
    return query select 'replay',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at; return;
  end if;
  insert into short_links(slug,destination_url,destination_type,status,expires_at,metadata,integration_source,external_request_id,external_user_id,external_resource_id,request_payload_hash,created_via)
  values(p_slug,p_destination_url,'whatsapp','active',p_expires_at,coalesce(p_metadata,'{}'::jsonb),'geobot',p_request_id,p_external_user_id,p_external_resource_id,p_payload_hash,'internal_api') returning * into v_link;
  update integration_requests set status='completed',response_status=201,short_link_id=v_link.id,completed_at=now() where id=v_request_id;
  insert into audit_logs(action,entity_type,entity_id,after_data) values('integration_link_create','short_link',v_link.id,jsonb_build_object('integration_source','geobot','request_id',p_request_id,'external_resource_id',p_external_resource_id));
  return query select 'created',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at;
end;
$$;

revoke all on function public.create_geobot_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_geobot_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) to service_role;

create or replace function public.update_geobot_link_slug(
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
  if v_link.integration_source is distinct from 'geobot' then
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
    jsonb_build_object('slug',v_link.slug::text,'integration_source','geobot','request_id',p_request_id)
  );

  return query select 'updated',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at,v_link.last_accessed_at,v_link.click_count;
end;
$$;

revoke all on function public.update_geobot_link_slug(uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_geobot_link_slug(uuid,text,text) to service_role;

create or replace function public.check_and_record_geobot_rate_limit(
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
  if p_source<>'geobot'
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

revoke all on function public.check_and_record_geobot_rate_limit(text,text,text,text,int,int,int) from public,anon,authenticated;
grant execute on function public.check_and_record_geobot_rate_limit(text,text,text,text,int,int,int) to service_role;

insert into public.app_settings(key,value) values
('integrations.geobot.enabled','false'),
('integrations.geobot.creation_enabled','false'),
('integrations.geobot.minute_limit','20'),
('integrations.geobot.hourly_limit','100'),
('integrations.geobot.daily_limit','1000'),
('integrations.geobot.maximum_expiration_days','3650'),
('integrations.geobot.maximum_message_length','1000')
on conflict(key) do nothing;

commit;
