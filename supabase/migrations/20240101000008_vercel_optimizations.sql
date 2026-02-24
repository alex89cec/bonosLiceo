-- RPC to regenerate tickets for a campaign (used when editing number range)
-- Runs entirely on DB side to avoid serverless function timeout
create or replace function regenerate_campaign_tickets(
  p_campaign_id uuid,
  p_number_from int,
  p_number_to int
) returns void
language plpgsql security definer
as $$
begin
  -- Delete existing available tickets
  delete from public.tickets
  where campaign_id = p_campaign_id and status = 'available';

  -- Generate new tickets
  insert into public.tickets (campaign_id, number, status, seller_id)
  select
    p_campaign_id,
    lpad(i::text, 5, '0'),
    'available',
    null
  from generate_series(p_number_from, p_number_to) as i;
end;
$$;
