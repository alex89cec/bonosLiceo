-- Add must_change_password flag to profiles
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Update existing profiles to false (they already changed or are admins)
update public.profiles set must_change_password = false where must_change_password is null;
