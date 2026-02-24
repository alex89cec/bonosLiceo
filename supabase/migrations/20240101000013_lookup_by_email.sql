-- ============================================================
-- Migration 13: Lookup reservations by email only
-- Returns all active/confirmed reservations for a given email
-- ============================================================

create or replace function public.lookup_reservations_by_email(
  p_buyer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_normalized_email text;
begin
  v_normalized_email := lower(trim(p_buyer_email));

  if v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'reservation_id', r.id,
      'ticket_number', t.number,
      'campaign_name', c.name,
      'status', r.status,
      'expires_at', r.expires_at,
      'payment_status', p.status,
      'payment_mode', p.payment_mode,
      'amount', p.amount
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_result
  from public.reservations r
  join public.tickets t on t.id = r.ticket_id
  join public.campaigns c on c.id = r.campaign_id
  join public.buyers b on b.id = r.buyer_id
  join public.payments p on p.reservation_id = r.id
  where b.email = v_normalized_email
    and r.status in ('active', 'confirmed');

  return jsonb_build_object(
    'success', true,
    'reservations', v_result,
    'count', jsonb_array_length(v_result)
  );
end;
$$;

grant execute on function public.lookup_reservations_by_email(text) to anon;
grant execute on function public.lookup_reservations_by_email(text) to authenticated;
