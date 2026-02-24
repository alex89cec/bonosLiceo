-- ============================================================
-- Rifas Liceo — Migration 1: Schema Init
-- Tables, constraints, indexes
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'seller')),
  full_name   text not null,
  email       text not null,
  phone       text,
  seller_code text unique, -- only for sellers; random 8-char token
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-generate seller_code for seller profiles
create or replace function public.generate_seller_code()
returns trigger as $$
begin
  if new.role = 'seller' and new.seller_code is null then
    new.seller_code := encode(gen_random_bytes(4), 'hex');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_seller_code
  before insert on public.profiles
  for each row execute function public.generate_seller_code();

-- updated_at trigger (reusable)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  description             text,
  start_date              timestamptz not null,
  end_date                timestamptz not null,
  status                  text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  ticket_price            numeric(10,2) not null check (ticket_price > 0),
  installments_enabled    boolean not null default false,
  installments_count      int not null default 1 check (installments_count >= 1),
  reservation_ttl_minutes int not null default 15 check (reservation_ttl_minutes >= 1),
  max_tickets_per_buyer   int not null default 1 check (max_tickets_per_buyer >= 1),
  created_by              uuid references public.profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint chk_campaign_dates check (end_date > start_date)
);

create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create index idx_campaigns_slug on public.campaigns(slug);
create index idx_campaigns_status on public.campaigns(status);

-- ============================================================
-- 3. CAMPAIGN_SELLERS (assignment of sellers to campaigns)
-- ============================================================
create table public.campaign_sellers (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  seller_id    uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),

  constraint uq_campaign_seller unique (campaign_id, seller_id)
);

create index idx_campaign_sellers_campaign on public.campaign_sellers(campaign_id);
create index idx_campaign_sellers_seller on public.campaign_sellers(seller_id);

-- ============================================================
-- 4. TICKETS
-- ============================================================
create table public.tickets (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  seller_id    uuid not null references public.profiles(id),
  number       text not null,
  status       text not null default 'assigned_to_seller'
                 check (status in ('assigned_to_seller', 'reserved', 'sold', 'released')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Each number is unique within a campaign
  constraint uq_ticket_campaign_number unique (campaign_id, number),

  -- Enforce exactly 6 digits
  constraint chk_ticket_number_format check (number ~ '^[0-9]{6}$')
);

create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- Composite indexes for common queries
create index idx_tickets_campaign_seller_status on public.tickets(campaign_id, seller_id, status);
create index idx_tickets_campaign_number on public.tickets(campaign_id, number);
create index idx_tickets_seller_id on public.tickets(seller_id);
create index idx_tickets_status on public.tickets(status);

-- ============================================================
-- 5. BUYERS (public, no auth)
-- ============================================================
create table public.buyers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_buyers_updated_at
  before update on public.buyers
  for each row execute function public.set_updated_at();

create index idx_buyers_email on public.buyers(email);

-- ============================================================
-- 6. RESERVATIONS
-- ============================================================
create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id),
  buyer_id      uuid not null references public.buyers(id),
  campaign_id   uuid not null references public.campaigns(id),
  seller_id     uuid not null references public.profiles(id),
  status        text not null default 'active'
                  check (status in ('active', 'expired', 'confirmed', 'cancelled')),
  expires_at    timestamptz not null,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),

  -- Only one active/confirmed reservation per ticket
  constraint uq_reservation_ticket_active
    exclude using btree (ticket_id with =)
    where (status in ('active', 'confirmed'))
);

create index idx_reservations_expires_at on public.reservations(expires_at) where status = 'active';
create index idx_reservations_ticket on public.reservations(ticket_id);
create index idx_reservations_buyer on public.reservations(buyer_id);
create index idx_reservations_campaign_seller on public.reservations(campaign_id, seller_id);
create index idx_reservations_status on public.reservations(status);

-- ============================================================
-- 7. PAYMENTS
-- ============================================================
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id),
  buyer_id        uuid not null references public.buyers(id),
  campaign_id     uuid not null references public.campaigns(id),
  amount          numeric(10,2) not null check (amount > 0),
  payment_mode    text not null check (payment_mode in ('full_payment', 'installments')),
  status          text not null default 'pending'
                    check (status in ('pending', 'partial', 'completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create index idx_payments_reservation on public.payments(reservation_id);
create index idx_payments_status on public.payments(status);

-- ============================================================
-- 8. INSTALLMENTS
-- ============================================================
create table public.installments (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments(id) on delete cascade,
  number       int not null check (number >= 1),
  amount       numeric(10,2) not null check (amount > 0),
  due_date     date not null,
  paid_at      timestamptz,
  status       text not null default 'pending'
                 check (status in ('pending', 'paid', 'overdue')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint uq_installment_payment_number unique (payment_id, number)
);

create trigger trg_installments_updated_at
  before update on public.installments
  for each row execute function public.set_updated_at();

create index idx_installments_payment on public.installments(payment_id);
create index idx_installments_due_date on public.installments(due_date) where status = 'pending';

-- ============================================================
-- 9. AUDIT LOG
-- ============================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  performed_by uuid, -- null for public/system actions
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_log_table_record on public.audit_log(table_name, record_id);
create index idx_audit_log_created_at on public.audit_log(created_at);
create index idx_audit_log_performed_by on public.audit_log(performed_by);

-- Generic audit trigger function
create or replace function public.audit_trigger_func()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log(table_name, record_id, action, new_data, performed_by)
    values (TG_TABLE_NAME, new.id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log(table_name, record_id, action, old_data, new_data, performed_by)
    values (TG_TABLE_NAME, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log(table_name, record_id, action, old_data, performed_by)
    values (TG_TABLE_NAME, old.id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Attach audit triggers to critical tables
create trigger audit_tickets
  after insert or update or delete on public.tickets
  for each row execute function public.audit_trigger_func();

create trigger audit_reservations
  after insert or update or delete on public.reservations
  for each row execute function public.audit_trigger_func();

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_trigger_func();

create trigger audit_installments
  after insert or update or delete on public.installments
  for each row execute function public.audit_trigger_func();
