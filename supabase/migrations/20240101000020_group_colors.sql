-- Add color column to seller_groups for visual group identity
ALTER TABLE public.seller_groups
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue';
