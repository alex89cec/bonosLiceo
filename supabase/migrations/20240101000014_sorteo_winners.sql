-- ============================================================
-- Migration 14: Sorteo (Raffle Drawing) — Winners Table + RPCs
-- ============================================================

-- ============================================================
-- 1. WINNERS TABLE
-- ============================================================
create table if not exists public.winners (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  ticket_id     uuid not null references public.tickets(id),
  ticket_number text not null,
  buyer_name    text,
  buyer_email   text not null,
  position      int not null default 1,
  drawn_at      timestamptz not null default now(),
  drawn_by      uuid not null references public.profiles(id),

  constraint uq_winner_campaign_ticket unique (campaign_id, ticket_id),
  constraint uq_winner_campaign_position unique (campaign_id, position)
);

create index if not exists idx_winners_campaign on public.winners(campaign_id);
create index if not exists idx_winners_ticket on public.winners(ticket_id);

-- Audit trigger
create trigger audit_winners
  after insert or update or delete on public.winners
  for each row execute function public.audit_trigger_func();

-- ============================================================
-- 2. RLS POLICIES
-- ============================================================
alter table public.winners enable row level security;

-- Admin: full access
create policy "admin_winners_all"
  on public.winners for all
  using (public.is_admin())
  with check (public.is_admin());

-- Public/anon: read winners for closed campaigns
create policy "anon_winners_select_closed"
  on public.winners for select
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = winners.campaign_id
        and c.status = 'closed'
    )
  );

-- ============================================================
-- 3. RPC: DRAW RANDOM WINNERS
-- ============================================================
create or replace function public.draw_random_winners(
  p_campaign_id  uuid,
  p_count        int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role  text;
  v_caller_id    uuid;
  v_campaign     public.campaigns%rowtype;
  v_next_pos     int;
  v_drawn        jsonb := '[]'::jsonb;
  v_row          record;
begin
  -- Authorization: only admin
  v_caller_id := auth.uid();
  select role into v_caller_role
  from public.profiles
  where id = v_caller_id;

  if v_caller_role is null or v_caller_role <> 'admin' then
    raise exception 'Solo administradores pueden realizar el sorteo';
  end if;

  -- Validate count
  if p_count < 1 or p_count > 100 then
    raise exception 'La cantidad de ganadores debe estar entre 1 y 100';
  end if;

  -- Validate campaign exists and is active
  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'Campaña no encontrada';
  end if;

  if v_campaign.status <> 'active' then
    raise exception 'La campaña debe estar activa para realizar el sorteo';
  end if;

  -- Get current max position
  select coalesce(max(position), 0) into v_next_pos
  from public.winners
  where campaign_id = p_campaign_id;

  -- Select random eligible tickets that are not already winners
  for v_row in
    select
      t.id as ticket_id,
      t.number as ticket_number,
      b.full_name as buyer_name,
      b.email as buyer_email
    from public.tickets t
    join public.reservations r on r.ticket_id = t.id
      and r.campaign_id = p_campaign_id
      and r.status = 'confirmed'
    join public.payments p on p.reservation_id = r.id
      and p.status = 'completed'
    join public.buyers b on b.id = r.buyer_id
    where t.campaign_id = p_campaign_id
      and t.status = 'sold'
      and not exists (
        select 1 from public.winners w
        where w.campaign_id = p_campaign_id
          and w.ticket_id = t.id
      )
    order by random()
    limit p_count
  loop
    v_next_pos := v_next_pos + 1;

    insert into public.winners (
      campaign_id, ticket_id, ticket_number,
      buyer_name, buyer_email, position, drawn_by
    ) values (
      p_campaign_id, v_row.ticket_id, v_row.ticket_number,
      v_row.buyer_name, v_row.buyer_email, v_next_pos, v_caller_id
    );

    v_drawn := v_drawn || jsonb_build_object(
      'position', v_next_pos,
      'ticket_number', v_row.ticket_number,
      'buyer_name', v_row.buyer_name,
      'buyer_email', v_row.buyer_email
    );
  end loop;

  if jsonb_array_length(v_drawn) = 0 then
    raise exception 'No hay boletos elegibles para el sorteo';
  end if;

  if jsonb_array_length(v_drawn) < p_count then
    return jsonb_build_object(
      'success', true,
      'requested', p_count,
      'drawn', jsonb_array_length(v_drawn),
      'winners', v_drawn,
      'warning', 'Se sortearon menos ganadores de los solicitados por falta de boletos elegibles'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'requested', p_count,
    'drawn', jsonb_array_length(v_drawn),
    'winners', v_drawn
  );
end;
$$;

grant execute on function public.draw_random_winners(uuid, int) to authenticated;

-- ============================================================
-- 4. RPC: ADD MANUAL WINNER
-- ============================================================
create or replace function public.add_manual_winner(
  p_campaign_id    uuid,
  p_ticket_number  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role  text;
  v_caller_id    uuid;
  v_campaign     public.campaigns%rowtype;
  v_ticket       public.tickets%rowtype;
  v_reservation  public.reservations%rowtype;
  v_payment      public.payments%rowtype;
  v_buyer        public.buyers%rowtype;
  v_next_pos     int;
begin
  -- Authorization
  v_caller_id := auth.uid();
  select role into v_caller_role
  from public.profiles
  where id = v_caller_id;

  if v_caller_role is null or v_caller_role <> 'admin' then
    raise exception 'Solo administradores pueden agregar ganadores';
  end if;

  -- Validate ticket number format
  if p_ticket_number !~ '^[0-9]{5}$' then
    raise exception 'Formato de número inválido (debe ser 5 dígitos)';
  end if;

  -- Validate campaign
  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id;

  if not found then
    raise exception 'Campaña no encontrada';
  end if;

  if v_campaign.status <> 'active' then
    raise exception 'La campaña debe estar activa para agregar ganadores';
  end if;

  -- Find the ticket
  select * into v_ticket
  from public.tickets
  where campaign_id = p_campaign_id
    and number = p_ticket_number;

  if not found then
    raise exception 'Boleto % no encontrado en esta campaña', p_ticket_number;
  end if;

  -- Check ticket is sold
  if v_ticket.status <> 'sold' then
    raise exception 'El boleto % no está vendido (estado: %)', p_ticket_number, v_ticket.status;
  end if;

  -- Check reservation is confirmed
  select * into v_reservation
  from public.reservations
  where ticket_id = v_ticket.id
    and campaign_id = p_campaign_id
    and status = 'confirmed';

  if not found then
    raise exception 'El boleto % no tiene una reserva confirmada', p_ticket_number;
  end if;

  -- Check payment is completed
  select * into v_payment
  from public.payments
  where reservation_id = v_reservation.id
    and status = 'completed';

  if not found then
    raise exception 'El boleto % no tiene el pago completado', p_ticket_number;
  end if;

  -- Check not already a winner
  if exists (
    select 1 from public.winners
    where campaign_id = p_campaign_id
      and ticket_id = v_ticket.id
  ) then
    raise exception 'El boleto % ya es ganador en esta campaña', p_ticket_number;
  end if;

  -- Get buyer info
  select * into v_buyer
  from public.buyers
  where id = v_reservation.buyer_id;

  -- Get next position
  select coalesce(max(position), 0) + 1 into v_next_pos
  from public.winners
  where campaign_id = p_campaign_id;

  -- Insert winner
  insert into public.winners (
    campaign_id, ticket_id, ticket_number,
    buyer_name, buyer_email, position, drawn_by
  ) values (
    p_campaign_id, v_ticket.id, v_ticket.number,
    v_buyer.full_name, v_buyer.email, v_next_pos, v_caller_id
  );

  return jsonb_build_object(
    'success', true,
    'winner', jsonb_build_object(
      'position', v_next_pos,
      'ticket_number', v_ticket.number,
      'buyer_name', v_buyer.full_name,
      'buyer_email', v_buyer.email
    )
  );
end;
$$;

grant execute on function public.add_manual_winner(uuid, text) to authenticated;
