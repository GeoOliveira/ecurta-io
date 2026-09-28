-- A link retains the selected public domain even if the default changes later.
begin;

alter table public.short_links
  add column if not exists short_domain text not null default 'https://encurta.io';

insert into public.app_settings(key,value) values
  ('shortener.allowed_domains','["https://encurta.io","https://curto.ink"]'::jsonb)
on conflict (key) do nothing;

-- Existing rows are Encurta.io links and remain valid without URL changes.
update public.short_links
set short_domain = 'https://encurta.io'
where short_domain is null or short_domain = '';

commit;
