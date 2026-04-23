-- ============================================================
-- Rifas Liceo — Migration 22: Events & Tickets (Phase 1)
-- Adds event ticketing system with QR codes
-- Separate from raffle bonos — uses its own table family prefixed "event_"
-- ============================================================

-- ============================================================
-- 1. EVENTS
-- ============================================================
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  event_date    timestamptz not null,
  venue         text,
  image_url     text,
  status        text not null default 'draft'
                check (status in ('draft', 'active', 'past', 'cancelled')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create index idx_events_slug on public.events(slug);
create index idx_events_status on public.events(status);
create index idx_events_date on public.events(event_date);

-- ============================================================
-- 2. EVENT_TICKET_TYPES
-- ============================================================
create table public.event_ticket_types (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  name              text not null,                      -- "General", "VIP", etc.
  description       text,
  price             numeric(10,2) not null check (price >= 0),
  quantity          int not null check (quantity > 0),  -- cupo total
  color             text default 'gray',                -- for UI display
  sales_start_at    timestamptz,                        -- optional: para Early Bird
  sales_end_at      timestamptz,                        -- optional
  is_complimentary  boolean not null default false,     -- solo admin puede emitir
  display_order     int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_ticket_type_sales_window check (
    sales_start_at is null or sales_end_at is null or sales_end_at > sales_start_at
  )
);

create trigger trg_event_ticket_types_updated_at
  before update on public.event_ticket_types
  for each row execute function public.set_updated_at();

create index idx_event_ticket_types_event on public.event_ticket_types(event_id);

-- ============================================================
-- 3. EVENT_TICKETS (each sold admission)
-- ============================================================
create table public.event_tickets (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete restrict,
  ticket_type_id    uuid not null references public.event_ticket_types(id) on delete restrict,
  buyer_id          uuid not null references public.buyers(id) on delete restrict,
  seller_id         uuid references public.profiles(id) on delete set null, -- nullable for public sales
  payment_id        uuid references public.payments(id) on delete set null, -- nullable for cortesías
  qr_token          text not null unique,               -- base64(ticket_id + "." + hmac)
  status            text not null default 'valid'
                    check (status in ('valid', 'used', 'cancelled', 'refunded')),
  entered_at        timestamptz,
  entered_by        uuid references public.profiles(id) on delete set null,
  is_complimentary  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_event_tickets_updated_at
  before update on public.event_tickets
  for each row execute function public.set_updated_at();

create index idx_event_tickets_event on public.event_tickets(event_id);
create index idx_event_tickets_buyer on public.event_tickets(buyer_id);
create index idx_event_tickets_seller on public.event_tickets(seller_id);
create index idx_event_tickets_qr on public.event_tickets(qr_token);
create index idx_event_tickets_status on public.event_tickets(status);

-- ============================================================
-- 4. EVENT_SELLERS (assignment of sellers to events)
-- ============================================================
create table public.event_sellers (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  can_sell      boolean not null default true,
  can_scan      boolean not null default false,
  assigned_at   timestamptz not null default now(),

  constraint uq_event_seller unique (event_id, seller_id)
);

create index idx_event_sellers_event on public.event_sellers(event_id);
create index idx_event_sellers_seller on public.event_sellers(seller_id);

-- ============================================================
-- 5. EVENT_SCAN_LOGS (audit trail for all scans)
-- ============================================================
create table public.event_scan_logs (
  id                uuid primary key default gen_random_uuid(),
  event_ticket_id   uuid references public.event_tickets(id) on delete set null,
  event_id          uuid references public.events(id) on delete set null,
  scanned_by        uuid references public.profiles(id) on delete set null,
  scanned_at        timestamptz not null default now(),
  result            text not null
                    check (result in ('valid', 'already_used', 'invalid', 'wrong_event', 'cancelled')),
  metadata          jsonb
);

create index idx_event_scan_logs_ticket on public.event_scan_logs(event_ticket_id);
create index idx_event_scan_logs_event on public.event_scan_logs(event_id);
create index idx_event_scan_logs_scanned_by on public.event_scan_logs(scanned_by);
create index idx_event_scan_logs_scanned_at on public.event_scan_logs(scanned_at desc);

-- ============================================================
-- 6. PENDING_ORDERS (Mercado Pago in-flight orders)
-- ============================================================
create table public.pending_orders (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  buyer_email          text not null,
  buyer_name           text,
  buyer_phone          text,
  items                jsonb not null,         -- [{ticket_type_id, quantity, price}]
  total                numeric(10,2) not null,
  mp_preference_id     text,                   -- Mercado Pago preference ID
  mp_payment_id        text,                   -- MP payment ID (once paid)
  seller_code          text,                   -- attribution code
  status               text not null default 'pending'
                       check (status in ('pending', 'approved', 'failed', 'expired', 'cancelled')),
  expires_at           timestamptz not null default (now() + interval '30 minutes'),
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_pending_orders_updated_at
  before update on public.pending_orders
  for each row execute function public.set_updated_at();

create index idx_pending_orders_status on public.pending_orders(status);
create index idx_pending_orders_mp_preference on public.pending_orders(mp_preference_id);
create index idx_pending_orders_mp_payment on public.pending_orders(mp_payment_id);
create index idx_pending_orders_email on public.pending_orders(buyer_email);

-- ============================================================
-- RLS — Events module
-- ============================================================

-- Helper: check if current user is assigned to an event (for selling or scanning)
create or replace function public.seller_assigned_to_event(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_sellers
    where seller_id = auth.uid() and event_id = p_event_id
  );
$$ language sql security definer stable;

create or replace function public.seller_can_scan_event(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_sellers
    where seller_id = auth.uid() and event_id = p_event_id and can_scan = true
  );
$$ language sql security definer stable;

create or replace function public.seller_can_sell_event(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_sellers
    where seller_id = auth.uid() and event_id = p_event_id and can_sell = true
  );
$$ language sql security definer stable;

-- EVENTS
alter table public.events enable row level security;

create policy "admin_events_all"
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_events_select_assigned"
  on public.events for select
  using (public.is_seller() and public.seller_assigned_to_event(id));

-- Public read for active events (for the public ticket portal)
create policy "anon_events_select_active"
  on public.events for select
  using (status = 'active');

-- EVENT_TICKET_TYPES
alter table public.event_ticket_types enable row level security;

create policy "admin_event_ticket_types_all"
  on public.event_ticket_types for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_event_ticket_types_select"
  on public.event_ticket_types for select
  using (public.is_seller() and public.seller_assigned_to_event(event_id));

-- Public read for ticket types of active events
create policy "anon_event_ticket_types_select"
  on public.event_ticket_types for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_types.event_id and e.status = 'active'
    )
  );

-- EVENT_TICKETS
alter table public.event_tickets enable row level security;

create policy "admin_event_tickets_all"
  on public.event_tickets for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_event_tickets_select_own"
  on public.event_tickets for select
  using (public.is_seller() and seller_id = auth.uid());

-- Sellers assigned as scanners can read tickets of events they scan (to validate)
create policy "scanner_event_tickets_select"
  on public.event_tickets for select
  using (public.is_seller() and public.seller_can_scan_event(event_id));

-- Scanners can update (to mark as entered) tickets in events they scan
create policy "scanner_event_tickets_update"
  on public.event_tickets for update
  using (public.is_seller() and public.seller_can_scan_event(event_id))
  with check (public.is_seller() and public.seller_can_scan_event(event_id));

-- EVENT_SELLERS
alter table public.event_sellers enable row level security;

create policy "admin_event_sellers_all"
  on public.event_sellers for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_event_sellers_select_own"
  on public.event_sellers for select
  using (seller_id = auth.uid());

-- EVENT_SCAN_LOGS
alter table public.event_scan_logs enable row level security;

create policy "admin_event_scan_logs_select"
  on public.event_scan_logs for select
  using (public.is_admin());

-- Scanners can insert their own scan logs
create policy "scanner_event_scan_logs_insert"
  on public.event_scan_logs for insert
  with check (
    public.is_seller() and
    scanned_by = auth.uid() and
    public.seller_can_scan_event(event_id)
  );

-- Scanners can read scan logs for events they scan
create policy "scanner_event_scan_logs_select"
  on public.event_scan_logs for select
  using (public.is_seller() and public.seller_can_scan_event(event_id));

-- PENDING_ORDERS — admin only read; inserts via RPC/API route only
alter table public.pending_orders enable row level security;

create policy "admin_pending_orders_all"
  on public.pending_orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- STORAGE — event-images bucket (for event cover images)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "Public read access on event-images"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "Admin upload to event-images"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Admin update event-images"
  on storage.objects for update
  using (
    bucket_id = 'event-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Admin delete from event-images"
  on storage.objects for delete
  using (
    bucket_id = 'event-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
