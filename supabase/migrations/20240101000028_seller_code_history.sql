-- ============================================================
-- Rifas Liceo — Migration 28: seller_code history
--
-- When a user changes their seller_code, the old code is preserved
-- in `seller_code_history` so previously-shared sale links keep
-- attributing future purchases to the correct seller.
--
-- Codes (current OR historical) must remain globally unique to avoid
-- ambiguity at lookup time.
-- ============================================================

alter table public.profiles
  add column if not exists seller_code_history text[] not null default '{}';

create index if not exists idx_profiles_seller_code_history_gin
  on public.profiles using gin (seller_code_history);
