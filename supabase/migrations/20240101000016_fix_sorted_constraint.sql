-- ============================================================
-- Migration 16: Fix campaigns status CHECK constraint
-- Add 'sorted' to allowed status values
-- Previous constraint only allowed: draft, active, closed
-- ============================================================

-- Drop the old constraint
alter table public.campaigns drop constraint if exists campaigns_status_check;

-- Re-add with 'sorted' included
alter table public.campaigns
  add constraint campaigns_status_check
    check (status in ('draft', 'active', 'sorted', 'closed'));
