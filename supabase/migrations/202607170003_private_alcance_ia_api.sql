alter table public.short_links
  add column if not exists integration_source text,
  add column if not exists external_request_id text,
  add column if not exists external_user_id text,
  add column if not exists external_resource_id text,
  add column if not exists request_payload_hash char(64),
  add column if not exists created_via text not null default 'admin';

alter table public.short_links
  add constraint short_links_created_via_check check (created_via in ('admin','internal_api','admin_test')),
  add constraint short_links_integration_request_unique unique (integration_source,external_request_id);

create index if not exists short_links_integration_source_idx on public.short_links(integration_source);
create index if not exists short_links_external_user_idx on public.short_links(external_user_id) where external_user_id is not null;
create index if not exists short_links_integration_created_idx on public.short_links(integration_source,created_at desc);

create table public.integration_requests(
  id uuid primary key default gen_random_uuid(),
  integration_source text not null,
  request_id varchar(100) not null,
  payload_hash char(64) not null,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  response_status int,
  short_link_id uuid references public.short_links(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default now()+interval '7 days',
  unique(integration_source,request_id)
);

create table public.integration_api_events(
  id uuid primary key default gen_random_uuid(),
  integration_source text not null,
  request_id varchar(100),
  endpoint text not null,
  method varchar(8) not null,
  status_code int not null,
  action text not null,
  short_link_id uuid references public.short_links(id),
  external_user_id varchar(100),
  duration_ms int,
  error_code text,
  created_at timestamptz not null default now()
);
create index integration_requests_created_idx on public.integration_requests(integration_source,created_at desc);
create index integration_events_rate_idx on public.integration_api_events(integration_source,endpoint,action,created_at desc);
create index integration_events_created_idx on public.integration_api_events(integration_source,created_at desc);

alter table public.integration_requests enable row level security;
alter table public.integration_api_events enable row level security;
revoke all on public.integration_requests from public,anon,authenticated;
revoke all on public.integration_api_events from public,anon,authenticated;
grant all on public.integration_requests to service_role;
grant all on public.integration_api_events to service_role;

create or replace function public.create_internal_whatsapp_short_link(
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
  if p_slug !~ '^[A-Za-z0-9]{8,32}$' or p_destination_url !~ '^https://wa\.me/[0-9]+(\?.*)?$' then raise exception 'invalid link data'; end if;
  insert into integration_requests(integration_source,request_id,payload_hash)
  values('alcance_ia',p_request_id,p_payload_hash)
  on conflict(integration_source,request_id) do nothing returning id into v_request_id;
  if v_request_id is null then
    select * into v_existing from integration_requests where integration_source='alcance_ia' and request_id=p_request_id for update;
    if v_existing.payload_hash<>p_payload_hash then return query select 'conflict',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    if v_existing.short_link_id is null then return query select 'processing',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    select * into v_link from short_links where id=v_existing.short_link_id;
    return query select 'replay',v_link.id,v_link.slug,v_link.status,v_link.expires_at,v_link.created_at; return;
  end if;
  insert into short_links(slug,destination_url,destination_type,status,expires_at,metadata,integration_source,external_request_id,external_user_id,external_resource_id,request_payload_hash,created_via)
  values(p_slug,p_destination_url,'whatsapp','active',p_expires_at,coalesce(p_metadata,'{}'::jsonb),'alcance_ia',p_request_id,p_external_user_id,p_external_resource_id,p_payload_hash,'internal_api') returning * into v_link;
  update integration_requests set status='completed',response_status=201,short_link_id=v_link.id,completed_at=now() where id=v_request_id;
  insert into audit_logs(action,entity_type,entity_id,after_data) values('integration_link_create','short_link',v_link.id,jsonb_build_object('integration_source','alcance_ia','request_id',p_request_id,'external_resource_id',p_external_resource_id));
  return query select 'created',v_link.id,v_link.slug,v_link.status,v_link.expires_at,v_link.created_at;
end;
$$;
revoke all on function public.create_internal_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_internal_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) to service_role;

create or replace function public.check_and_record_integration_rate_limit(p_source text,p_endpoint text,p_request_id text,p_minute_limit int,p_hour_limit int,p_day_limit int)
returns table(allowed boolean,limit_value int,remaining int,reset_at bigint)
language plpgsql security definer set search_path=public as $$
declare v_minute int;v_hour int;v_day int;
begin
  if p_source<>'alcance_ia' or p_minute_limit<1 or p_hour_limit<1 or p_day_limit<1 then raise exception 'invalid rate limit configuration'; end if;
  perform pg_advisory_xact_lock(hashtext(p_source||':'||p_endpoint));
  select count(*) into v_minute from integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 minute';
  select count(*) into v_hour from integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 hour';
  select count(*) into v_day from integration_api_events where integration_source=p_source and endpoint=p_endpoint and action='request_received' and created_at>=now()-interval '1 day';
  if v_minute>=p_minute_limit then return query select false,p_minute_limit,0,extract(epoch from now()+interval '1 minute')::bigint;return;end if;
  if v_hour>=p_hour_limit then return query select false,p_hour_limit,0,extract(epoch from now()+interval '1 hour')::bigint;return;end if;
  if v_day>=p_day_limit then return query select false,p_day_limit,0,extract(epoch from now()+interval '1 day')::bigint;return;end if;
  insert into integration_api_events(integration_source,request_id,endpoint,method,status_code,action) values(p_source,p_request_id,p_endpoint,case when p_endpoint like '%{id}%' then 'GET' else 'POST' end,0,'request_received');
  return query select true,p_minute_limit,greatest(0,p_minute_limit-v_minute-1),extract(epoch from now()+interval '1 minute')::bigint;
end;
$$;
revoke all on function public.check_and_record_integration_rate_limit(text,text,text,int,int,int) from public,anon,authenticated;
grant execute on function public.check_and_record_integration_rate_limit(text,text,text,int,int,int) to service_role;

insert into public.app_settings(key,value) values
('integrations.alcance_ia.enabled','false'),
('integrations.alcance_ia.creation_enabled','false'),
('integrations.alcance_ia.minute_limit','20'),
('integrations.alcance_ia.hourly_limit','200'),
('integrations.alcance_ia.daily_limit','1000'),
('integrations.alcance_ia.maximum_expiration_days','3650'),
('integrations.alcance_ia.maximum_message_length','1000'),
('integrations.alcance_ia.logging_enabled','true'),
('integrations.alcance_ia.audit_enabled','true'),
('integrations.alcance_ia.maintenance_mode','false'),
('integrations.alcance_ia.maintenance_message','"Integração temporariamente indisponível."')
on conflict(key) do nothing;
