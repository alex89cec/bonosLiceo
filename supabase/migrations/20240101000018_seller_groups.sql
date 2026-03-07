-- ============================================================
-- Migration 18: Seller Groups (Teams) with Campaign-to-Group Assignment
-- Enables organizing sellers into groups led by admins.
-- Campaigns assigned to a group auto-sync campaign_sellers rows.
-- ============================================================

-- 1. seller_groups table
create table public.seller_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  admin_id    uuid not null references public.profiles(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_seller_groups_updated_at
  before update on public.seller_groups
  for each row execute function public.set_updated_at();

create index idx_seller_groups_admin on public.seller_groups(admin_id);

-- 2. Add group_id to profiles
alter table public.profiles
  add column group_id uuid references public.seller_groups(id) on delete set null;

create index idx_profiles_group on public.profiles(group_id);

-- 3. campaign_groups junction table
create table public.campaign_groups (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  group_id     uuid not null references public.seller_groups(id) on delete cascade,
  assigned_at  timestamptz not null default now(),

  constraint uq_campaign_group unique (campaign_id, group_id)
);

create index idx_campaign_groups_campaign on public.campaign_groups(campaign_id);
create index idx_campaign_groups_group on public.campaign_groups(group_id);

-- ============================================================
-- 4. Auto-sync triggers
-- ============================================================

-- 4a. When a campaign is assigned to a group → create campaign_sellers for all group members
create or replace function public.sync_campaign_group_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.campaign_sellers (campaign_id, seller_id)
  select NEW.campaign_id, p.id
  from public.profiles p
  where p.group_id = NEW.group_id
    and p.role = 'seller'
    and p.is_active = true
  on conflict (campaign_id, seller_id) do nothing;

  return NEW;
end;
$$;

create trigger trg_campaign_group_insert
  after insert on public.campaign_groups
  for each row execute function public.sync_campaign_group_insert();

-- 4b. When a campaign is removed from a group → remove campaign_sellers
--     (only for sellers with no active/confirmed reservations on that campaign)
create or replace function public.sync_campaign_group_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.campaign_sellers cs
  where cs.campaign_id = OLD.campaign_id
    and cs.seller_id in (
      select p.id from public.profiles p
      where p.group_id = OLD.group_id
        and p.role = 'seller'
    )
    and not exists (
      select 1 from public.reservations r
      where r.campaign_id = OLD.campaign_id
        and r.seller_id = cs.seller_id
        and r.status in ('active', 'confirmed')
    );

  return OLD;
end;
$$;

create trigger trg_campaign_group_delete
  after delete on public.campaign_groups
  for each row execute function public.sync_campaign_group_delete();

-- 4c. When a seller's group_id changes → sync their campaign_sellers
create or replace function public.sync_seller_group_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only applies to sellers
  if NEW.role <> 'seller' then
    return NEW;
  end if;

  -- If group didn't change, nothing to do
  if OLD.group_id is not distinct from NEW.group_id then
    return NEW;
  end if;

  -- Remove from old group's campaigns (if safe)
  if OLD.group_id is not null then
    delete from public.campaign_sellers cs
    where cs.seller_id = NEW.id
      and cs.campaign_id in (
        select cg.campaign_id from public.campaign_groups cg
        where cg.group_id = OLD.group_id
      )
      and not exists (
        select 1 from public.reservations r
        where r.campaign_id = cs.campaign_id
          and r.seller_id = NEW.id
          and r.status in ('active', 'confirmed')
      );
  end if;

  -- Add to new group's campaigns
  if NEW.group_id is not null then
    insert into public.campaign_sellers (campaign_id, seller_id)
    select cg.campaign_id, NEW.id
    from public.campaign_groups cg
    where cg.group_id = NEW.group_id
    on conflict (campaign_id, seller_id) do nothing;
  end if;

  return NEW;
end;
$$;

create trigger trg_seller_group_change
  before update of group_id on public.profiles
  for each row execute function public.sync_seller_group_change();

-- ============================================================
-- 5. RLS policies
-- ============================================================

-- seller_groups
alter table public.seller_groups enable row level security;

create policy "admin_seller_groups_all"
  on public.seller_groups for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_groups_select_own"
  on public.seller_groups for select
  using (
    public.is_seller() and
    id = (select group_id from public.profiles where id = auth.uid())
  );

-- campaign_groups
alter table public.campaign_groups enable row level security;

create policy "admin_campaign_groups_all"
  on public.campaign_groups for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_campaign_groups_select_own"
  on public.campaign_groups for select
  using (
    public.is_seller() and
    group_id = (select group_id from public.profiles where id = auth.uid())
  );
