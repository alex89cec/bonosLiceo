-- ============================================================
-- Rifas Liceo — Migration 25: Transfer data on events + preventa flow
--
-- 1. Add transfer/CBU/alias fields to events
-- 2. Add 'awaiting_receipt' status for orders created without receipt
--    (preventa: seller creates order, buyer gets email with transfer data,
--     seller uploads receipt later)
-- ============================================================

-- 1. Transfer data on events (all optional — only used when payment by transferencia)
alter table public.events
  add column if not exists transfer_holder_name text,
  add column if not exists transfer_cbu          text,
  add column if not exists transfer_alias        text,
  add column if not exists transfer_bank         text,
  add column if not exists transfer_id_number    text,
  add column if not exists transfer_instructions text;

-- 2. New order status 'awaiting_receipt'
alter table public.event_orders
  drop constraint if exists event_orders_status_check;

alter table public.event_orders
  add constraint event_orders_status_check
  check (status in ('awaiting_receipt', 'pending_review', 'approved', 'rejected', 'cancelled', 'complimentary'));

-- 3. Relax the receipt-required constraint:
--    receipt is required UNLESS the order is cortesia OR awaiting_receipt
alter table public.event_orders
  drop constraint if exists chk_receipt_required;

alter table public.event_orders
  add constraint chk_receipt_required check (
    payment_method = 'cortesia'
    or status = 'awaiting_receipt'
    or receipt_url is not null
  );
