-- ============================================================
-- Migration 10: Auto-assign admins to all campaigns
-- - Assign all existing admins to all existing campaigns
-- - Add trigger: when a campaign is created, auto-assign all admins
-- - Add trigger: when a new admin profile is created, auto-assign to all active campaigns
-- ============================================================

-- ============================================================
-- 1. ASSIGN EXISTING ADMINS TO ALL EXISTING CAMPAIGNS
-- ============================================================
insert into public.campaign_sellers (campaign_id, seller_id)
select c.id, p.id
from public.campaigns c
cross join public.profiles p
where p.role = 'admin'
  and not exists (
    select 1 from public.campaign_sellers cs
    where cs.campaign_id = c.id and cs.seller_id = p.id
  );

-- ============================================================
-- 2. TRIGGER: auto-assign all admins when a new campaign is created
-- ============================================================
create or replace function public.auto_assign_admins_to_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.campaign_sellers (campaign_id, seller_id)
  select NEW.id, p.id
  from public.profiles p
  where p.role = 'admin' and p.is_active = true
  on conflict (campaign_id, seller_id) do nothing;

  return NEW;
end;
$$;

create trigger trg_auto_assign_admins_on_campaign
  after insert on public.campaigns
  for each row
  execute function public.auto_assign_admins_to_campaign();

-- ============================================================
-- 3. TRIGGER: auto-assign admin to all active campaigns when profile becomes admin
-- ============================================================
create or replace function public.auto_assign_admin_to_campaigns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fire when role is set to 'admin' (insert or update)
  if NEW.role = 'admin' and (TG_OP = 'INSERT' or OLD.role <> 'admin') then
    insert into public.campaign_sellers (campaign_id, seller_id)
    select c.id, NEW.id
    from public.campaigns c
    where c.status in ('draft', 'active')
    on conflict (campaign_id, seller_id) do nothing;
  end if;

  return NEW;
end;
$$;

create trigger trg_auto_assign_admin_to_campaigns
  after insert or update of role on public.profiles
  for each row
  execute function public.auto_assign_admin_to_campaigns();
