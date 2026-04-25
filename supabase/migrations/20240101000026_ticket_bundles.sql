-- ============================================================
-- Rifas Liceo — Migration 26: Ticket bundles (packs)
--
-- Adds support for bundle pricing (e.g., "Grupo Familiar 2 adultos +
-- 2 menores") with configurable composition.
--
-- - is_bundle_only on event_ticket_types: type only sellable as part
--   of a bundle (e.g., Menor — never sold individually).
-- - bundle_items on event_ticket_types: jsonb array of components.
--   When non-null, the type IS a bundle.
-- - parent_bundle_type_id on event_tickets: traceback to the bundle
--   type the ticket was generated from (null for individual sales).
-- ============================================================

-- 1. New columns on event_ticket_types
alter table public.event_ticket_types
  add column if not exists is_bundle_only boolean not null default false,
  add column if not exists bundle_items jsonb;

-- A type can't be both a bundle and bundle_only at the same time
alter table public.event_ticket_types
  add constraint chk_bundle_consistency check (
    not (is_bundle_only = true and bundle_items is not null)
  );

-- 2. New column on event_tickets to trace bundle origin
alter table public.event_tickets
  add column if not exists parent_bundle_type_id uuid
    references public.event_ticket_types(id) on delete set null;

create index if not exists idx_event_tickets_parent_bundle
  on public.event_tickets(parent_bundle_type_id)
  where parent_bundle_type_id is not null;
