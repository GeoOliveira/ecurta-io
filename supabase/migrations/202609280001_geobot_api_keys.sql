create table public.integration_api_keys(
  id uuid primary key default gen_random_uuid(),
  integration_source text not null check(integration_source in ('geobot')),
  label text not null check(char_length(label) between 1 and 80),
  key_prefix text not null,
  key_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  unique(integration_source,key_hash)
);
create index integration_api_keys_source_active_idx on public.integration_api_keys(integration_source,created_at desc) where revoked_at is null;
alter table public.integration_api_keys enable row level security;
revoke all on public.integration_api_keys from public,anon,authenticated;
grant all on public.integration_api_keys to service_role;
