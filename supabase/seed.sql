-- ============================================================
-- Rifas Liceo — Seed Data
-- Demo: 1 admin, 1 seller, 1 campaign, sample tickets
-- ============================================================

-- NOTE: This seed assumes you've already created auth users via
-- Supabase dashboard or CLI. The UUIDs below are placeholders.
-- For local dev, use supabase auth admin commands.

-- Create auth users first (Supabase local dev)
-- Admin user
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@rifasliceo.com',
  crypt('admin123456', gen_salt('bf')),
  now(), now(), now(), 'authenticated', 'authenticated'
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'admin@rifasliceo.com'),
  'email',
  now(), now(), now()
);

-- Seller user
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values (
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'seller1@rifasliceo.com',
  crypt('seller123456', gen_salt('bf')),
  now(), now(), now(), 'authenticated', 'authenticated'
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'b0000000-0000-0000-0000-000000000001', 'email', 'seller1@rifasliceo.com'),
  'email',
  now(), now(), now()
);

-- Profiles
insert into public.profiles (id, role, full_name, email, seller_code)
values
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'Admin Principal', 'admin@rifasliceo.com', null),
  ('b0000000-0000-0000-0000-000000000001', 'seller', 'María García', 'seller1@rifasliceo.com', 'sel1abc0');

-- Campaign
insert into public.campaigns (
  id, name, slug, description,
  start_date, end_date, status,
  ticket_price, installments_enabled, installments_count,
  reservation_ttl_minutes, max_tickets_per_buyer, created_by
) values (
  'c0000000-0000-0000-0000-000000000001',
  'Rifa Navideña 2024',
  'rifa-navidena-2024',
  'Gran rifa navideña del Liceo con premios increíbles',
  '2024-11-01T00:00:00Z',
  '2024-12-24T23:59:59Z',
  'active',
  50.00,
  true,
  3,
  15,
  1,
  'a0000000-0000-0000-0000-000000000001'
);

-- Assign seller to campaign
insert into public.campaign_sellers (campaign_id, seller_id)
values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

-- Allocate 20 sample ticket numbers to the seller
insert into public.tickets (campaign_id, seller_id, number, status)
values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000001', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000002', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000003', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000004', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000005', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000010', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000020', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000050', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000100', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000200', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '000500', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '001000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '005000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '010000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '050000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '100000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '250000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '500000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '750000', 'assigned_to_seller'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '999999', 'assigned_to_seller');
