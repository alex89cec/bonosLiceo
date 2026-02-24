-- ============================================================
-- Migration 12: Optimize ticket generation trigger
-- Replace row-by-row INSERT loop with set-based generate_series
-- for much faster campaign creation (especially large ranges)
-- ============================================================

create or replace function public.generate_campaign_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tickets (campaign_id, seller_id, number, status)
  select
    NEW.id,
    null,
    lpad(i::text, 5, '0'),
    'available'
  from generate_series(NEW.number_from, NEW.number_to) as i;

  return NEW;
end;
$$;
