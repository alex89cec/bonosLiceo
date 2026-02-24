-- ============================================================
-- Rifas Liceo — Migration 3: RPC Functions
-- Atomic reservation, cleanup, payment confirmation
-- ============================================================

-- ============================================================
-- 1. RESERVE TICKET (atomic, concurrency-safe)
-- ============================================================
-- Called by public (anon) users via supabase.rpc('reserve_ticket', {...})
-- SECURITY DEFINER so it bypasses RLS and runs with full access.
-- All validation happens inside the function.

create or replace function public.reserve_ticket(
  p_campaign_slug  text,
  p_seller_code    text,
  p_buyer_email    text,
  p_ticket_number  text,
  p_payment_mode   text,
  p_buyer_name     text default null,
  p_buyer_phone    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign       public.campaigns%rowtype;
  v_seller         public.profiles%rowtype;
  v_ticket         public.tickets%rowtype;
  v_buyer_id       uuid;
  v_reservation_id uuid;
  v_payment_id     uuid;
  v_expires_at     timestamptz;
  v_normalized_email text;
  v_buyer_ticket_count int;
  v_installment_amount numeric(10,2);
  v_due_date       date;
begin
  -- =============================================
  -- Input validation
  -- =============================================
  if p_payment_mode not in ('full_payment', 'installments') then
    raise exception 'Invalid payment_mode: %', p_payment_mode;
  end if;

  if p_ticket_number !~ '^[0-9]{6}$' then
    raise exception 'Invalid ticket number format';
  end if;

  -- Normalize email
  v_normalized_email := lower(trim(p_buyer_email));
  if v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address';
  end if;

  -- =============================================
  -- Step 1: Validate campaign is active
  -- =============================================
  select * into v_campaign
  from public.campaigns
  where slug = p_campaign_slug
    and status = 'active'
    and now() between start_date and end_date;

  if not found then
    raise exception 'Campaign not found or not active';
  end if;

  -- Check if installments requested but not enabled
  if p_payment_mode = 'installments' and not v_campaign.installments_enabled then
    raise exception 'Installments not enabled for this campaign';
  end if;

  -- =============================================
  -- Step 2: Validate seller exists and is assigned
  -- =============================================
  select * into v_seller
  from public.profiles
  where seller_code = p_seller_code
    and role = 'seller'
    and is_active = true;

  if not found then
    raise exception 'Seller not found';
  end if;

  -- Verify seller is assigned to this campaign
  if not exists (
    select 1 from public.campaign_sellers
    where campaign_id = v_campaign.id
      and seller_id = v_seller.id
  ) then
    raise exception 'Seller not assigned to this campaign';
  end if;

  -- =============================================
  -- Step 3: Lock ticket row (FOR UPDATE) — concurrency gate
  -- =============================================
  select * into v_ticket
  from public.tickets
  where campaign_id = v_campaign.id
    and number = p_ticket_number
    and seller_id = v_seller.id
  for update;  -- Row-level lock: blocks concurrent reservations

  if not found then
    raise exception 'Ticket not found for this seller';
  end if;

  -- Check if ticket has an expired reservation (lazy cleanup)
  if v_ticket.status = 'reserved' then
    -- Check if reservation is expired
    if exists (
      select 1 from public.reservations
      where ticket_id = v_ticket.id
        and status = 'active'
        and expires_at < now()
    ) then
      -- Expire the old reservation
      update public.reservations
      set status = 'expired'
      where ticket_id = v_ticket.id
        and status = 'active'
        and expires_at < now();

      -- Release the ticket
      update public.tickets
      set status = 'assigned_to_seller'
      where id = v_ticket.id;

      -- Re-read ticket with updated status
      select * into v_ticket
      from public.tickets
      where id = v_ticket.id
      for update;
    end if;
  end if;

  -- Now verify ticket is actually available
  if v_ticket.status <> 'assigned_to_seller' then
    raise exception 'Ticket is not available (current status: %)', v_ticket.status;
  end if;

  -- =============================================
  -- Step 4: Create or fetch buyer
  -- =============================================
  select id into v_buyer_id
  from public.buyers
  where email = v_normalized_email;

  if v_buyer_id is null then
    insert into public.buyers (email, full_name, phone)
    values (v_normalized_email, p_buyer_name, p_buyer_phone)
    returning id into v_buyer_id;
  else
    -- Update name/phone if provided and currently null
    update public.buyers
    set
      full_name = coalesce(buyers.full_name, p_buyer_name),
      phone = coalesce(buyers.phone, p_buyer_phone)
    where id = v_buyer_id;
  end if;

  -- =============================================
  -- Step 5: Check max tickets per buyer per campaign
  -- =============================================
  select count(*) into v_buyer_ticket_count
  from public.reservations
  where buyer_id = v_buyer_id
    and campaign_id = v_campaign.id
    and status in ('active', 'confirmed');

  if v_buyer_ticket_count >= v_campaign.max_tickets_per_buyer then
    raise exception 'Maximum tickets per buyer reached for this campaign (limit: %)', v_campaign.max_tickets_per_buyer;
  end if;

  -- =============================================
  -- Step 6: Create reservation
  -- =============================================
  v_expires_at := now() + (v_campaign.reservation_ttl_minutes || ' minutes')::interval;

  insert into public.reservations (
    ticket_id, buyer_id, campaign_id, seller_id, status, expires_at
  ) values (
    v_ticket.id, v_buyer_id, v_campaign.id, v_seller.id, 'active', v_expires_at
  ) returning id into v_reservation_id;

  -- =============================================
  -- Step 7: Update ticket status to reserved
  -- =============================================
  update public.tickets
  set status = 'reserved'
  where id = v_ticket.id;

  -- =============================================
  -- Step 8: Create payment record
  -- =============================================
  insert into public.payments (
    reservation_id, buyer_id, campaign_id, amount, payment_mode, status
  ) values (
    v_reservation_id, v_buyer_id, v_campaign.id,
    v_campaign.ticket_price, p_payment_mode, 'pending'
  ) returning id into v_payment_id;

  -- =============================================
  -- Step 9: Create installments if applicable
  -- =============================================
  if p_payment_mode = 'installments' and v_campaign.installments_enabled then
    v_installment_amount := round(v_campaign.ticket_price / v_campaign.installments_count, 2);

    for i in 1..v_campaign.installments_count loop
      v_due_date := current_date + (i * 30); -- 30-day intervals

      insert into public.installments (
        payment_id, number, amount, due_date, status
      ) values (
        v_payment_id, i, v_installment_amount, v_due_date, 'pending'
      );
    end loop;
  end if;

  -- =============================================
  -- Return reservation summary
  -- =============================================
  return jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'ticket_number', v_ticket.number,
    'campaign_name', v_campaign.name,
    'ticket_price', v_campaign.ticket_price,
    'payment_mode', p_payment_mode,
    'installments_count', case
      when p_payment_mode = 'installments' then v_campaign.installments_count
      else 1
    end,
    'expires_at', v_expires_at,
    'buyer_email', v_normalized_email
  );
end;
$$;

-- Grant execute to anon (public users)
grant execute on function public.reserve_ticket(text, text, text, text, text, text, text) to anon;
grant execute on function public.reserve_ticket(text, text, text, text, text, text, text) to authenticated;


-- ============================================================
-- 2. CLEANUP EXPIRED RESERVATIONS
-- ============================================================
-- Can be called by cron (pg_cron / Supabase Edge Function) or admin

create or replace function public.cleanup_expired_reservations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count int := 0;
  v_reservation record;
begin
  -- Find and process all expired active reservations
  for v_reservation in
    select r.id as reservation_id, r.ticket_id
    from public.reservations r
    where r.status = 'active'
      and r.expires_at < now()
    for update of r  -- Lock reservation rows
  loop
    -- Expire the reservation
    update public.reservations
    set status = 'expired'
    where id = v_reservation.reservation_id;

    -- Release the ticket back to seller
    update public.tickets
    set status = 'assigned_to_seller'
    where id = v_reservation.ticket_id
      and status = 'reserved';

    -- Update payment to cancelled (if still pending)
    update public.payments
    set status = 'pending'  -- Keep as pending; admin can review
    where reservation_id = v_reservation.reservation_id
      and status = 'pending';

    v_expired_count := v_expired_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'cleaned_at', now()
  );
end;
$$;

-- Only admin and service role should call cleanup
grant execute on function public.cleanup_expired_reservations() to authenticated;


-- ============================================================
-- 3. CONFIRM PAYMENT (admin action)
-- ============================================================
-- Confirms payment for a reservation. If all installments are paid
-- (or full payment confirmed), ticket status moves to "sold".

create or replace function public.confirm_payment(
  p_reservation_id  uuid,
  p_installment_number int default null  -- null = confirm full payment
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation  public.reservations%rowtype;
  v_payment      public.payments%rowtype;
  v_all_paid     boolean;
  v_caller_role  text;
begin
  -- =============================================
  -- Authorization: only admin can confirm
  -- =============================================
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'admin' then
    raise exception 'Only admins can confirm payments';
  end if;

  -- =============================================
  -- Get reservation (lock it)
  -- =============================================
  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.status not in ('active', 'confirmed') then
    raise exception 'Reservation is not in a confirmable state (status: %)', v_reservation.status;
  end if;

  -- =============================================
  -- Get payment
  -- =============================================
  select * into v_payment
  from public.payments
  where reservation_id = p_reservation_id
  for update;

  if not found then
    raise exception 'Payment record not found';
  end if;

  -- =============================================
  -- Process based on payment mode
  -- =============================================
  if v_payment.payment_mode = 'full_payment' then
    -- Mark payment as completed
    update public.payments
    set status = 'completed'
    where id = v_payment.id;

    v_all_paid := true;

  elsif v_payment.payment_mode = 'installments' then
    if p_installment_number is null then
      raise exception 'Installment number required for installment payments';
    end if;

    -- Mark specific installment as paid
    update public.installments
    set status = 'paid', paid_at = now()
    where payment_id = v_payment.id
      and number = p_installment_number
      and status <> 'paid';

    if not found then
      raise exception 'Installment not found or already paid';
    end if;

    -- Check if all installments are now paid
    select not exists (
      select 1 from public.installments
      where payment_id = v_payment.id
        and status <> 'paid'
    ) into v_all_paid;

    -- Update payment status
    if v_all_paid then
      update public.payments
      set status = 'completed'
      where id = v_payment.id;
    else
      update public.payments
      set status = 'partial'
      where id = v_payment.id;
    end if;
  end if;

  -- =============================================
  -- If first payment confirmation, lock the reservation
  -- (prevent TTL expiry)
  -- =============================================
  if v_reservation.status = 'active' then
    update public.reservations
    set status = 'confirmed', confirmed_at = now()
    where id = p_reservation_id;
  end if;

  -- =============================================
  -- If all paid, mark ticket as sold
  -- =============================================
  if v_all_paid then
    update public.tickets
    set status = 'sold'
    where id = v_reservation.ticket_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'payment_status', case when v_all_paid then 'completed' else 'partial' end,
    'ticket_status', case when v_all_paid then 'sold' else 'reserved' end
  );
end;
$$;

grant execute on function public.confirm_payment(uuid, int) to authenticated;


-- ============================================================
-- 4. GET AVAILABLE TICKETS (public, scoped)
-- ============================================================
-- Returns available ticket numbers for a specific campaign+seller.
-- Includes lazy cleanup of expired reservations.

create or replace function public.get_available_tickets(
  p_campaign_slug text,
  p_seller_code   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_seller_id   uuid;
  v_tickets     jsonb;
begin
  -- Resolve campaign
  select id into v_campaign_id
  from public.campaigns
  where slug = p_campaign_slug
    and status = 'active';

  if v_campaign_id is null then
    raise exception 'Campaign not found or not active';
  end if;

  -- Resolve seller
  select id into v_seller_id
  from public.profiles
  where seller_code = p_seller_code
    and role = 'seller'
    and is_active = true;

  if v_seller_id is null then
    raise exception 'Seller not found';
  end if;

  -- Verify seller assigned to campaign
  if not exists (
    select 1 from public.campaign_sellers
    where campaign_id = v_campaign_id
      and seller_id = v_seller_id
  ) then
    raise exception 'Seller not assigned to this campaign';
  end if;

  -- Lazy cleanup: expire any stale reservations for this seller's tickets
  update public.reservations
  set status = 'expired'
  where campaign_id = v_campaign_id
    and seller_id = v_seller_id
    and status = 'active'
    and expires_at < now();

  -- Release those tickets
  update public.tickets t
  set status = 'assigned_to_seller'
  where t.campaign_id = v_campaign_id
    and t.seller_id = v_seller_id
    and t.status = 'reserved'
    and not exists (
      select 1 from public.reservations r
      where r.ticket_id = t.id
        and r.status in ('active', 'confirmed')
    );

  -- Get available tickets
  select coalesce(jsonb_agg(
    jsonb_build_object('number', t.number)
    order by t.number
  ), '[]'::jsonb)
  into v_tickets
  from public.tickets t
  where t.campaign_id = v_campaign_id
    and t.seller_id = v_seller_id
    and t.status = 'assigned_to_seller';

  return jsonb_build_object(
    'success', true,
    'campaign_slug', p_campaign_slug,
    'seller_code', p_seller_code,
    'tickets', v_tickets,
    'count', jsonb_array_length(coalesce(v_tickets, '[]'::jsonb))
  );
end;
$$;

grant execute on function public.get_available_tickets(text, text) to anon;
grant execute on function public.get_available_tickets(text, text) to authenticated;


-- ============================================================
-- 5. LOOKUP RESERVATION (public, by email + reservation ID)
-- ============================================================
-- Allows buyer to check their reservation status without auth.

create or replace function public.lookup_reservation(
  p_reservation_id uuid,
  p_buyer_email    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'reservation_id', r.id,
    'ticket_number', t.number,
    'campaign_name', c.name,
    'status', r.status,
    'expires_at', r.expires_at,
    'payment_status', p.status,
    'payment_mode', p.payment_mode,
    'amount', p.amount
  ) into v_result
  from public.reservations r
  join public.tickets t on t.id = r.ticket_id
  join public.campaigns c on c.id = r.campaign_id
  join public.buyers b on b.id = r.buyer_id
  join public.payments p on p.reservation_id = r.id
  where r.id = p_reservation_id
    and b.email = lower(trim(p_buyer_email));

  if v_result is null then
    raise exception 'Reservation not found';
  end if;

  return jsonb_build_object('success', true, 'reservation', v_result);
end;
$$;

grant execute on function public.lookup_reservation(uuid, text) to anon;
grant execute on function public.lookup_reservation(uuid, text) to authenticated;
