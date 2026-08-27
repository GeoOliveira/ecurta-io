-- Expand existing WhatsApp support without changing any Alcance RPC or row.
begin;

create function public.is_public_short_url(raw text) returns boolean
language plpgsql immutable set search_path=public as $$
declare
  authority text;
  hostname text;
  address inet;
begin
  if raw is null or length(raw)>4096 or raw !~ '^https?://' or raw ~ '[[:space:][:cntrl:]]' or position(chr(92) in raw)>0 then return false; end if;
  authority := substring(raw from '^https?://([^/?#]+)');
  if authority is null or authority ~ '@' then return false; end if;
  if authority ~ '^\[' then
    if authority !~ '^\[[0-9a-f:]+\](:[0-9]{1,5})?$' then return false; end if;
    hostname := substring(authority from '^\[([^]]+)\]');
    address := hostname::inet;
    return address <<= '2000::/3'::inet and not address <<= '2001:db8::/32'::inet;
  end if;
  if authority !~ '^[a-z0-9.-]+(:[0-9]{1,5})?$' then return false; end if;
  hostname := rtrim(split_part(authority,':',1),'.');
  if hostname = 'encurta.io' or hostname like '%.encurta.io' or hostname ~ '(^|\.)(localhost|local|internal|invalid|test|onion)$' then return false; end if;
  if hostname ~ '^[0-9]+(\.[0-9]+){3}$' then
    address := hostname::inet;
    return not (address <<= any(array['0.0.0.0/8','10.0.0.0/8','127.0.0.0/8','224.0.0.0/3','100.64.0.0/10','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16','192.0.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24']::inet[]));
  end if;
  return length(hostname)<=253 and hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$';
exception when others then return false;
end;
$$;

alter table public.short_links drop constraint short_links_destination_url_check;
alter table public.short_links drop constraint short_links_destination_type_check;
alter table public.short_links add constraint short_links_destination_type_check
  check (destination_type in ('whatsapp','url'));
alter table public.short_links add constraint short_links_destination_url_check
  check (
    (destination_type='whatsapp' and destination_url like 'https://wa.me/%')
    or (destination_type='url' and integration_source is not distinct from 'geobot' and public.is_public_short_url(destination_url))
  );

create function public.create_geobot_url_short_link(
  p_request_id text, p_payload_hash text, p_slug text, p_destination_url text,
  p_expires_at timestamptz, p_external_user_id text, p_external_resource_id text,
  p_metadata jsonb default '{}'::jsonb
) returns table(result text,link_id uuid,slug text,link_status public.short_link_status,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
  v_request_id uuid;
  v_existing public.integration_requests%rowtype;
  v_link public.short_links%rowtype;
begin
  if p_request_id is null or p_payload_hash is null or p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' or p_payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid integration request'; end if;
  if p_slug is null or p_slug !~ '^[A-Za-z0-9]{4,32}$' or not public.is_public_short_url(p_destination_url) then raise exception 'invalid link data'; end if;
  insert into integration_requests(integration_source,request_id,payload_hash)
  values('geobot',p_request_id,p_payload_hash)
  on conflict(integration_source,request_id) do nothing returning id into v_request_id;
  if v_request_id is null then
    select * into v_existing from integration_requests where integration_source='geobot' and request_id=p_request_id for update;
    if v_existing.payload_hash<>p_payload_hash then return query select 'conflict',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    if v_existing.short_link_id is null then return query select 'processing',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    select * into v_link from short_links where id=v_existing.short_link_id;
    if v_link.destination_type <> 'url' then return query select 'conflict',null::uuid,null::text,null::public.short_link_status,null::timestamptz,null::timestamptz; return; end if;
    return query select 'replay',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at; return;
  end if;
  insert into short_links(slug,destination_url,destination_type,status,expires_at,metadata,integration_source,external_request_id,external_user_id,external_resource_id,request_payload_hash,created_via)
  values(p_slug,p_destination_url,'url','active',p_expires_at,coalesce(p_metadata,'{}'::jsonb),'geobot',p_request_id,p_external_user_id,p_external_resource_id,p_payload_hash,'internal_api') returning * into v_link;
  update integration_requests set status='completed',response_status=201,short_link_id=v_link.id,completed_at=now() where id=v_request_id;
  insert into audit_logs(action,entity_type,entity_id,after_data) values('integration_link_create','short_link',v_link.id,jsonb_build_object('integration_source','geobot','destination_type','url','request_id',p_request_id,'external_resource_id',p_external_resource_id));
  return query select 'created',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at;
end;
$$;
revoke all on function public.create_geobot_url_short_link(text,text,text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_geobot_url_short_link(text,text,text,text,timestamptz,text,text,jsonb) to service_role;

-- Retain the legacy signature; only the server uses the richer resolver.
create function public.resolve_short_link_v2(p_slug text)
returns table(id uuid,slug text,destination_url text,status public.short_link_status,expires_at timestamptz,destination_type text,integration_source text)
language sql stable security definer set search_path=public as $$
  select s.id,s.slug::text,s.destination_url,s.status,s.expires_at,s.destination_type,s.integration_source
  from public.short_links s where s.slug=p_slug and s.deleted_at is null limit 1;
$$;
revoke all on function public.resolve_short_link_v2(text) from public,anon,authenticated;
grant execute on function public.resolve_short_link_v2(text) to service_role;

commit;
