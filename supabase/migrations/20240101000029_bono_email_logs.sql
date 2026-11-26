-- ============================================================
-- Rifas Liceo — Migration 29: log of bono confirmation emails
-- ============================================================
-- One row per send attempt of the buyer confirmation email. A single email
-- covers every number the buyer got in that send, hence reservation_ids[].
-- Lets admins see which bonos got their email and resend the missing ones.

create table public.bono_email_logs (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.buyers(id) on delete cascade,
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  reservation_ids  uuid[] not null,
  recipient        text not null,
  status           text not null check (status in ('sent', 'failed')),
  provider_id      text,
  error            text,
  sent_by          uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index idx_bono_email_logs_reservations
  on public.bono_email_logs using gin (reservation_ids);
create index idx_bono_email_logs_created
  on public.bono_email_logs (created_at desc);

alter table public.bono_email_logs enable row level security;

create policy "admin_bono_email_logs_select"
  on public.bono_email_logs for select
  using (public.is_admin() or public.is_approver());

-- Inserts happen via API routes using the service role (bypasses RLS).
