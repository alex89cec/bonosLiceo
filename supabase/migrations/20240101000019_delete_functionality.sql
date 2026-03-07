-- Migration 19: Delete functionality
-- Adds RPC function for safe campaign deletion with audit trigger management

create or replace function public.delete_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_caller_role text;
begin
  -- Auth check: only admins
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'admin' then
    raise exception 'Solo administradores pueden eliminar campañas';
  end if;

  -- Get campaign status
  select status into v_status
  from public.campaigns
  where id = p_campaign_id;

  if not found then
    raise exception 'Campaña no encontrada';
  end if;

  if v_status not in ('draft', 'closed') then
    raise exception 'Solo se pueden eliminar campañas en estado borrador o cerrada';
  end if;

  -- Disable audit triggers for bulk delete performance
  alter table public.tickets disable trigger audit_tickets;
  alter table public.reservations disable trigger audit_reservations;
  alter table public.payments disable trigger audit_payments;
  alter table public.installments disable trigger audit_installments;
  alter table public.winners disable trigger audit_winners;

  -- Delete non-cascading dependents (in dependency order)
  delete from public.installments
  where payment_id in (
    select id from public.payments where campaign_id = p_campaign_id
  );

  delete from public.payments
  where campaign_id = p_campaign_id;

  delete from public.reservations
  where campaign_id = p_campaign_id;

  -- Delete campaign (CASCADE handles: tickets, campaign_sellers, campaign_groups, winners)
  delete from public.campaigns
  where id = p_campaign_id;

  -- Re-enable audit triggers
  alter table public.tickets enable trigger audit_tickets;
  alter table public.reservations enable trigger audit_reservations;
  alter table public.payments enable trigger audit_payments;
  alter table public.installments enable trigger audit_installments;
  alter table public.winners enable trigger audit_winners;
end;
$$;

-- Grant execute to authenticated users (RPC checks admin role internally)
grant execute on function public.delete_campaign(uuid) to authenticated;
