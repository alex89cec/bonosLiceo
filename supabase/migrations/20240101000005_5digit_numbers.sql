-- ============================================================
-- Migration 5: 5-digit numbers + return all tickets with status
-- - Change from 6-digit to 5-digit number format (00000-99999)
-- - Max 10,000 tickets per campaign
-- - Update campaign constraints
-- - Update ticket generation trigger
-- - Update RPCs to return all tickets with status
-- ============================================================

-- ============================================================
-- 1. UPDATE CAMPAIGN CONSTRAINTS
-- ============================================================
alter table public.campaigns drop constraint chk_campaign_number_range;

alter table public.campaigns
  add constraint chk_campaign_number_range
    check (number_to > number_from and number_from >= 0 and number_to <= 99999);

alter table public.campaigns alter column number_to set default 9999;

-- ============================================================
-- 2. CONVERT EXISTING TICKET NUMBERS: 6-digit -> 5-digit
-- ============================================================

-- Drop old 6-digit format constraint first
alter table public.tickets drop constraint if exists chk_ticket_number_format;

-- Drop unique constraint temporarily to avoid conflicts during conversion
alter table public.tickets drop constraint if exists uq_ticket_campaign_number;

-- Delete tickets with numbers > 99999 (can't fit in 5-digit format)
delete from public.tickets
where number::int > 99999;

-- Convert remaining 6-digit to 5-digit
update public.tickets
set number = lpad(number::int::text, 5, '0')
where length(number) = 6;

-- Re-add unique constraint
alter table public.tickets
  add constraint uq_ticket_campaign_number
    unique (campaign_id, number);

-- Add new 5-digit format constraint
alter table public.tickets
  add constraint chk_ticket_number_format
    check (number ~ '^[0-9]{5}$');

-- ============================================================
-- 3. UPDATE TRIGGER: generate 5-digit ticket numbers
-- ============================================================
create or replace function public.generate_campaign_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num int;
begin
  for v_num in NEW.number_from..NEW.number_to loop
    insert into public.tickets (campaign_id, seller_id, number, status)
    values (NEW.id, null, lpad(v_num::text, 5, '0'), 'available');
  end loop;
  return NEW;
end;
$$;

-- ============================================================
-- 4. RECREATE get_available_tickets: return ALL tickets with status
-- ============================================================
drop function if exists public.get_available_tickets(text);

create or replace function public.get_available_tickets(
  p_campaign_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_tickets     jsonb;
  v_available   int;
begin
  -- Resolve campaign
  select id into v_campaign_id
  from public.campaigns
  where slug = p_campaign_slug and status = 'active';

  if v_campaign_id is null then
    raise exception 'Campaign not found or not active';
  end if;

  -- Get ALL tickets with status
  select coalesce(jsonb_agg(
    jsonb_build_object('number', t.number, 'status', t.status)
    order by t.number
  ), '[]'::jsonb)
  into v_tickets
  from public.tickets t
  where t.campaign_id = v_campaign_id;

  -- Count available
  select count(*) into v_available
  from public.tickets
  where campaign_id = v_campaign_id and status = 'available';

  return jsonb_build_object(
    'success', true,
    'campaign_slug', p_campaign_slug,
    'tickets', v_tickets,
    'total', jsonb_array_length(coalesce(v_tickets, '[]'::jsonb)),
    'available', v_available
  );
end;
$$;

grant execute on function public.get_available_tickets(text) to anon;
grant execute on function public.get_available_tickets(text) to authenticated;

-- ============================================================
-- 5. RECREATE reserve_ticket: 5-digit validation
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

  -- Step 2: Validate seller exists and is assigned
  select * into v_seller
  from public.profiles
  where seller_code = p_seller_code
    and role = 'seller'
    and is_active = true;

  if not found then
    raise exception 'Seller not found';
  end if;

  if not exists (
    select 1 from public.campaign_sellers
    where campaign_id = v_campaign.id
      and seller_id = v_seller.id
  ) then
    raise exception 'Seller not assigned to this campaign';
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
