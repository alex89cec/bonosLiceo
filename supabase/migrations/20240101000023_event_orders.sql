-- ============================================================
-- Rifas Liceo — Migration 23: Event Orders (manual payments)
-- Replaces Mercado Pago integration with manual transfer + receipt upload
-- Tickets are generated only after admin approval
-- Only is_approver admins can approve/reject orders
-- ============================================================

-- ============================================================
-- 1. Approver flag on profiles
-- ============================================================
alter table public.profiles
  add column if not exists is_approver boolean not null default false;

-- Bootstrap initial approvers
update public.profiles
   set is_approver = true
 where email in ('admin@rifasliceo.com', 'amedinar89@gmail.com');

create index if not exists idx_profiles_is_approver on public.profiles(is_approver) where is_approver = true;

-- ============================================================
-- 2. Drop pending_orders (was scoped to MP, not used yet)
-- ============================================================
drop table if exists public.pending_orders;

-- ============================================================
-- 3. EVENT_ORDERS — manual payment orders
-- ============================================================
create table public.event_orders (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete restrict,
  buyer_id            uuid not null references public.buyers(id) on delete restrict,
  seller_id           uuid references public.profiles(id) on delete set null,

  -- Snapshot of cart at submission (immutable record of what was ordered)
  items               jsonb not null,
  total_amount        numeric(10,2) not null check (total_amount >= 0),

  payment_method      text not null check (payment_method in ('transferencia', 'cortesia')),

  -- Receipt (required for transferencia, null for cortesia)
  receipt_url         text,
  receipt_filename    text,
  receipt_mime_type   text,
  receipt_uploaded_at timestamptz,

  status              text not null default 'pending_review'
                      check (status in ('pending_review', 'approved', 'rejected', 'cancelled', 'complimentary')),

  reviewed_by         uuid references public.profiles(id) on delete set null,
  reviewed_at         timestamptz,
  rejection_reason    text,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Receipt is required unless this is a cortesia
  constraint chk_receipt_required check (
    payment_method = 'cortesia' or receipt_url is not null
  ),

  -- Cortesia must be auto-approved as complimentary
  constraint chk_cortesia_complimentary check (
    payment_method != 'cortesia' or status in ('complimentary', 'cancelled')
  )
);

create trigger trg_event_orders_updated_at
  before update on public.event_orders
  for each row execute function public.set_updated_at();

create index idx_event_orders_event on public.event_orders(event_id);
create index idx_event_orders_buyer on public.event_orders(buyer_id);
create index idx_event_orders_seller on public.event_orders(seller_id);
create index idx_event_orders_status on public.event_orders(status);
create index idx_event_orders_created_at on public.event_orders(created_at desc);

-- ============================================================
-- 4. Add order_id + amount_paid to event_tickets
-- ============================================================
alter table public.event_tickets
  add column if not exists order_id uuid references public.event_orders(id) on delete set null;

alter table public.event_tickets
  add column if not exists amount_paid numeric(10,2);

create index if not exists idx_event_tickets_order on public.event_tickets(order_id);

-- ============================================================
-- 5. is_approver helper
-- ============================================================
create or replace function public.is_approver()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
      and is_approver = true
  );
$$ language sql security definer stable;

-- ============================================================
-- 6. RLS — event_orders
-- ============================================================
alter table public.event_orders enable row level security;

-- All admins can READ orders
create policy "admin_event_orders_select"
  on public.event_orders for select
  using (public.is_admin());

-- Only approvers can UPDATE (approve/reject) — non-approver admins can only read
create policy "approver_event_orders_update"
  on public.event_orders for update
  using (public.is_approver())
  with check (public.is_approver());

-- Sellers can read their own orders
create policy "seller_event_orders_select_own"
  on public.event_orders for select
  using (public.is_seller() and seller_id = auth.uid());

-- INSERT happens via API routes using service role (bypasses RLS)
-- DELETE not allowed via direct queries; admins can cancel via UPDATE

-- ============================================================
-- 7. STORAGE — event-receipts bucket (PRIVATE)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-receipts', 'event-receipts', false)
on conflict (id) do nothing;

-- Only admins can READ receipts (for review)
create policy "Admin read event-receipts"
  on storage.objects for select
  using (
    bucket_id = 'event-receipts'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Admins can DELETE receipts if needed
create policy "Admin delete event-receipts"
  on storage.objects for delete
  using (
    bucket_id = 'event-receipts'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- INSERTs done via API routes using service role
