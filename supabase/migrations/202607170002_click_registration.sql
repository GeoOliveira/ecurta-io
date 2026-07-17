create or replace function public.register_short_link_click(p_link_id uuid, p_is_bot boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  update short_links set click_count = click_count + 1, last_accessed_at = now() where id = p_link_id and status = 'active' and deleted_at is null;
  insert into short_link_daily_stats(short_link_id, date, clicks, bot_clicks)
  values (p_link_id, current_date, 1, case when p_is_bot then 1 else 0 end)
  on conflict (short_link_id, date) do update set clicks = short_link_daily_stats.clicks + 1, bot_clicks = short_link_daily_stats.bot_clicks + excluded.bot_clicks;
end;
$$;
revoke all on function public.register_short_link_click(uuid, boolean) from public, anon, authenticated;
grant execute on function public.register_short_link_click(uuid, boolean) to service_role;
