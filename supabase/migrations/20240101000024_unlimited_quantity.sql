-- ============================================================
-- Rifas Liceo — Migration 24: Allow unlimited ticket types
-- quantity = null means unlimited stock (no cap)
-- ============================================================

-- Drop the existing NOT NULL + > 0 constraint
alter table public.event_ticket_types
  alter column quantity drop not null;

alter table public.event_ticket_types
  drop constraint if exists event_ticket_types_quantity_check;

-- Re-add: null means unlimited; otherwise must be positive
alter table public.event_ticket_types
  add constraint event_ticket_types_quantity_check
  check (quantity is null or quantity > 0);
