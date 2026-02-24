-- ============================================================
-- Rifas Liceo — Migration 2: Row Level Security
-- Every table gets RLS enabled + explicit policies
-- ============================================================

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$ language sql security definer stable;

-- Helper: check if current user is seller
create or replace function public.is_seller()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'seller' and is_active = true
  );
$$ language sql security definer stable;

-- Helper: check if seller is assigned to a campaign
create or replace function public.seller_assigned_to_campaign(p_campaign_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.campaign_sellers
    where seller_id = auth.uid() and campaign_id = p_campaign_id
  );
$$ language sql security definer stable;


-- ============================================================
-- PROFILES
-- ============================================================
alter table public.profiles enable row level security;

-- Admin: full access
create policy "admin_profiles_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read own profile only
create policy "seller_profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

-- Seller: update own profile (limited fields handled at app layer)
create policy "seller_profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
-- CAMPAIGNS
-- ============================================================
alter table public.campaigns enable row level security;

-- Admin: full CRUD
create policy "admin_campaigns_all"
  on public.campaigns for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read campaigns they are assigned to
create policy "seller_campaigns_select"
  on public.campaigns for select
  using (
    public.is_seller() and
    public.seller_assigned_to_campaign(id)
  );

-- Public/anon: read active campaigns by slug (for public reservation page)
create policy "anon_campaigns_select_active"
  on public.campaigns for select
  using (status = 'active');


-- ============================================================
-- CAMPAIGN_SELLERS
-- ============================================================
alter table public.campaign_sellers enable row level security;

-- Admin: full CRUD
create policy "admin_campaign_sellers_all"
  on public.campaign_sellers for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read own assignments
create policy "seller_campaign_sellers_select_own"
  on public.campaign_sellers for select
  using (seller_id = auth.uid());


-- ============================================================
-- TICKETS
-- ============================================================
alter table public.tickets enable row level security;

-- Admin: full access
create policy "admin_tickets_all"
  on public.tickets for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read own tickets only
create policy "seller_tickets_select_own"
  on public.tickets for select
  using (
    public.is_seller() and
    seller_id = auth.uid()
  );

-- Public/anon: read available tickets scoped to campaign+seller
-- (the public page queries by campaign_id + seller_id + status)
-- This policy allows reading tickets that are assigned_to_seller status
-- The actual scoping to a specific seller is done by the query filter,
-- but we restrict to only showing available (assigned_to_seller) tickets
-- to prevent enumeration of reserved/sold ticket data.
create policy "anon_tickets_select_available"
  on public.tickets for select
  using (status = 'assigned_to_seller');


-- ============================================================
-- BUYERS
-- ============================================================
alter table public.buyers enable row level security;

-- Admin: full access
create policy "admin_buyers_all"
  on public.buyers for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read buyers who have reservations on seller's tickets
create policy "seller_buyers_select"
  on public.buyers for select
  using (
    public.is_seller() and
    exists (
      select 1 from public.reservations r
      where r.buyer_id = buyers.id
        and r.seller_id = auth.uid()
    )
  );

-- Public/anon: NO direct read access to buyers table.
-- Buyer creation happens inside the reserve_ticket() RPC (security definer).
-- No policy needed for anon insert/select.


-- ============================================================
-- RESERVATIONS
-- ============================================================
alter table public.reservations enable row level security;

-- Admin: full access
create policy "admin_reservations_all"
  on public.reservations for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read reservations on their own tickets
create policy "seller_reservations_select_own"
  on public.reservations for select
  using (
    public.is_seller() and
    seller_id = auth.uid()
  );

-- Public/anon: NO direct access.
-- Reservations are created via reserve_ticket() RPC (security definer).
-- Buyers can look up their reservation via a separate secure RPC if needed.


-- ============================================================
-- PAYMENTS
-- ============================================================
alter table public.payments enable row level security;

-- Admin: full access
create policy "admin_payments_all"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read payments for their reservations
create policy "seller_payments_select_own"
  on public.payments for select
  using (
    public.is_seller() and
    exists (
      select 1 from public.reservations r
      where r.id = payments.reservation_id
        and r.seller_id = auth.uid()
    )
  );

-- Public/anon: NO direct access.


-- ============================================================
-- INSTALLMENTS
-- ============================================================
alter table public.installments enable row level security;

-- Admin: full access
create policy "admin_installments_all"
  on public.installments for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seller: read installments for their payments
create policy "seller_installments_select_own"
  on public.installments for select
  using (
    public.is_seller() and
    exists (
      select 1 from public.payments p
      join public.reservations r on r.id = p.reservation_id
      where p.id = installments.payment_id
        and r.seller_id = auth.uid()
    )
  );

-- Public/anon: NO direct access.


-- ============================================================
-- AUDIT_LOG
-- ============================================================
alter table public.audit_log enable row level security;

-- Admin: read only (no one should delete/modify audit logs)
create policy "admin_audit_log_select"
  on public.audit_log for select
  using (public.is_admin());

-- Insert is done by audit_trigger_func() which is SECURITY DEFINER.
-- Grant insert to the trigger function's execution context:
-- The trigger function runs as definer (superuser-like) so it can insert.
-- No user-facing insert policy needed.

-- Explicitly deny all other operations for safety
-- (RLS is enabled, and no INSERT/UPDATE/DELETE policies exist for non-admin)
