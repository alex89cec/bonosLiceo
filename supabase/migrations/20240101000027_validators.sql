-- ============================================================
-- Rifas Liceo — Migration 27: Make is_approver assignable to sellers
--
-- - Updates is_approver() helper to also allow sellers (not only admins).
-- - Adds a SELECT policy so seller-validators can read all event_orders
--   (admins already have full read; sellers had only their own).
-- - Bootstraps Santiago Prieto as a validator.
-- - Admin Principal protection is enforced at the API level (not DB)
--   so the migration here doesn't add a constraint for that.
-- ============================================================

-- 1. Allow sellers to be approvers too (was: admin-only)
create or replace function public.is_approver()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and is_approver = true
  );
$$ language sql security definer stable;

-- 2. Approver SELECT policy (covers sellers who are approvers; admins
--    already have admin_event_orders_select)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_orders'
      and policyname = 'approver_event_orders_select'
  ) then
    create policy "approver_event_orders_select"
      on public.event_orders for select
      using (public.is_approver());
  end if;
end$$;

-- 3. Bootstrap Santiago Prieto as validator
update public.profiles
   set is_approver = true
 where email = 'santiago.prieto451015@gmail.com';
