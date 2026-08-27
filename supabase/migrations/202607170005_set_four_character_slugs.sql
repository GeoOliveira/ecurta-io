update public.app_settings
set value='4'::jsonb,updated_at=now()
where key='shortener.slug_length';
