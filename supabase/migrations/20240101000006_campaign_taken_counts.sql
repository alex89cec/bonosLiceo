-- RPC: get taken (reserved/sold) ticket counts per campaign
create or replace function get_campaign_taken_counts()
returns table(campaign_id uuid, taken_count bigint)
language sql stable security definer
as $$
  select t.campaign_id, count(*) as taken_count
  from public.tickets t
  where t.status in ('reserved', 'sold')
  group by t.campaign_id;
$$;
