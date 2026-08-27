begin;

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
    return query select 'replay',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at; return;
  end if;
  insert into short_links(slug,destination_url,destination_type,status,expires_at,metadata,integration_source,external_request_id,external_user_id,external_resource_id,request_payload_hash,created_via)
  values(p_slug,p_destination_url,'whatsapp','active',p_expires_at,coalesce(p_metadata,'{}'::jsonb),'alcance_ia',p_request_id,p_external_user_id,p_external_resource_id,p_payload_hash,'internal_api') returning * into v_link;
  update integration_requests set status='completed',response_status=201,short_link_id=v_link.id,completed_at=now() where id=v_request_id;
  insert into audit_logs(action,entity_type,entity_id,after_data) values('integration_link_create','short_link',v_link.id,jsonb_build_object('integration_source','alcance_ia','request_id',p_request_id,'external_resource_id',p_external_resource_id));
  return query select 'created',v_link.id,v_link.slug::text,v_link.status,v_link.expires_at,v_link.created_at;
end;
$$;

revoke all on function public.create_internal_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_internal_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb) to service_role;

commit;
