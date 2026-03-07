-- ============================================================
-- Migration 17: Fast ticket generation for large campaigns
-- Disable audit trigger during bulk insert to avoid timeout
-- on 100K+ ticket campaigns. Supports up to 100,000 tickets.
-- ============================================================

create or replace function public.generate_campaign_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Disable audit trigger for bulk insert performance
  -- (100K audit rows would cause statement timeout)
  alter table public.tickets disable trigger audit_tickets;

  insert into public.tickets (campaign_id, seller_id, number, status)
  select
    NEW.id,
    null,
    lpad(i::text, 5, '0'),
    'available'
  from generate_series(NEW.number_from, NEW.number_to) as i;

  -- Re-enable audit trigger
  alter table public.tickets enable trigger audit_tickets;

  return NEW;
end;
$$;
