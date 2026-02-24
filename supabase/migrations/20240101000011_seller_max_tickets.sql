-- ============================================================
-- Migration 11: Per-seller-per-campaign ticket limits
-- - Add max_tickets column to campaign_sellers
-- - Update reserve_ticket RPC to enforce seller limits
-- ============================================================

-- ============================================================
-- 1. ADD max_tickets COLUMN TO campaign_sellers
-- ============================================================
alter table public.campaign_sellers
  add column max_tickets int default null;

alter table public.campaign_sellers
  add constraint chk_max_tickets_positive
    check (max_tickets is null or max_tickets > 0);

-- ============================================================
-- 2. RECREATE reserve_ticket WITH SELLER LIMIT CHECK
-- ============================================================
drop function if exists public.reserve_ticket(text, text, text, text, text, text, text);

create or replace function public.reserve_ticket(
  p_campaign_slug  text,
  p_seller_code    text,
  p_ticket_number  text,
  p_buyer_email    text,
  p_buyer_name     text default null,
  p_buyer_phone    text default null,
  p_payment_mode   text default 'full_payment'
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
  v_normalized_email text;
  v_buyer_ticket_count int;
  v_seller_ticket_count int;
  v_seller_max_tickets int;
  v_actual_payment_mode text;
  v_installment_amount numeric(10,2);
  v_due_date       date;
begin
  -- Determine payment mode
  v_actual_payment_mode := coalesce(p_payment_mode, 'full_payment');
  if v_actual_payment_mode not in ('full_payment', 'installments') then
    raise exception 'Invalid payment_mode: %', v_actual_payment_mode;
  end if;

  -- Validate ticket number format (5 digits)
  if p_ticket_number !~ '^[0-9]{5}$' then
    raise exception 'Invalid ticket number format';
  end if;

  -- Normalize email
  v_normalized_email := lower(trim(p_buyer_email));
  if v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address';
  end if;

  -- Step 1: Validate campaign is active
  select * into v_campaign
  from public.campaigns
  where slug = p_campaign_slug
    and status = 'active'
    and now() between start_date and end_date;

  if not found then
    raise exception 'Campaign not found or not active';
  end if;

  if v_actual_payment_mode = 'installments' and not v_campaign.installments_enabled then
    raise exception 'Installments not enabled for this campaign';
  end if;

  -- Step 2: Validate seller exists (allow both seller AND admin roles)
  select * into v_seller
  from public.profiles
  where seller_code = p_seller_code
    and role in ('seller', 'admin')
    and is_active = true;

  if not found then
    raise exception 'Seller not found';
  end if;

  -- Step 2b: Check campaign assignment (only for sellers, admins can sell any campaign)
  if v_seller.role = 'seller' then
    if not exists (
      select 1 from public.campaign_sellers
      where campaign_id = v_campaign.id
        and seller_id = v_seller.id
    ) then
      raise exception 'Seller not assigned to this campaign';
    end if;
  end if;

  -- Step 2c: Check per-seller-per-campaign ticket limit (applies to both roles)
  select max_tickets into v_seller_max_tickets
  from public.campaign_sellers
  where campaign_id = v_campaign.id
    and seller_id = v_seller.id
  for update;

  if v_seller_max_tickets is not null then
    select count(*) into v_seller_ticket_count
    from public.reservations
    where seller_id = v_seller.id
      and campaign_id = v_campaign.id
      and status in ('active', 'confirmed');

    if v_seller_ticket_count >= v_seller_max_tickets then
      raise exception 'Limite de ventas alcanzado para esta campana (limite: %)', v_seller_max_tickets;
    end if;
  end if;

  -- Step 3: Lock ticket from shared pool (FOR UPDATE)
  select * into v_ticket
  from public.tickets
  where campaign_id = v_campaign.id
    and number = p_ticket_number
  for update;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_ticket.status <> 'available' then
    raise exception 'Ticket is not available (current status: %)', v_ticket.status;
  end if;

  -- Step 4: Create or fetch buyer
  select id into v_buyer_id
  from public.buyers
  where email = v_normalized_email;

  if v_buyer_id is null then
    insert into public.buyers (email, full_name, phone)
    values (v_normalized_email, p_buyer_name, p_buyer_phone)
    returning id into v_buyer_id;
  else
    update public.buyers
    set
      full_name = coalesce(buyers.full_name, p_buyer_name),
      phone = coalesce(buyers.phone, p_buyer_phone)
    where id = v_buyer_id;
  end if;

  -- Step 5: Check max tickets per buyer per campaign
  select count(*) into v_buyer_ticket_count
  from public.reservations
  where buyer_id = v_buyer_id
    and campaign_id = v_campaign.id
    and status in ('active', 'confirmed');

  if v_buyer_ticket_count >= v_campaign.max_tickets_per_buyer then
    raise exception 'Maximum tickets per buyer reached (limit: %)', v_campaign.max_tickets_per_buyer;
  end if;

  -- Step 6: Create reservation (no expiry)
  insert into public.reservations (
    ticket_id, buyer_id, campaign_id, seller_id, status, expires_at
  ) values (
    v_ticket.id, v_buyer_id, v_campaign.id, v_seller.id, 'active', null
  ) returning id into v_reservation_id;

  -- Step 7: Assign ticket to seller and mark reserved
  update public.tickets
  set status = 'reserved', seller_id = v_seller.id
  where id = v_ticket.id;

  -- Step 8: Create payment record
  insert into public.payments (
    reservation_id, buyer_id, campaign_id, amount, payment_mode, status
  ) values (
    v_reservation_id, v_buyer_id, v_campaign.id,
    v_campaign.ticket_price, v_actual_payment_mode, 'pending'
  ) returning id into v_payment_id;

  -- Step 9: Create installments if applicable
  if v_actual_payment_mode = 'installments' and v_campaign.installments_enabled then
    v_installment_amount := round(v_campaign.ticket_price / v_campaign.installments_count, 2);

    for i in 1..v_campaign.installments_count loop
      v_due_date := current_date + (i * 30);

      insert into public.installments (
        payment_id, number, amount, due_date, status
      ) values (
        v_payment_id, i, v_installment_amount, v_due_date, 'pending'
      );
    end loop;
  end if;

  -- Return reservation summary
  return jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'ticket_number', v_ticket.number,
    'campaign_name', v_campaign.name,
    'ticket_price', v_campaign.ticket_price,
    'payment_mode', v_actual_payment_mode,
    'installments_count', case
      when v_actual_payment_mode = 'installments' then v_campaign.installments_count
      else 1
    end,
    'buyer_email', v_normalized_email,
    'seller_name', v_seller.full_name
  );
end;
$$;

grant execute on function public.reserve_ticket(text, text, text, text, text, text, text) to anon;
grant execute on function public.reserve_ticket(text, text, text, text, text, text, text) to authenticated;
