-- =====================================================================
-- TransViet Cargo Email Campaign Studio — Supabase schema
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run: uses "if not exists" / "or replace" where possible.
-- =====================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles — extends Supabase Auth users with app-specific fields.
-- Row is created by the create-user Edge Function when an admin adds
-- someone; there is no public self-registration.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('admin','manager','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  gender text not null default 'unknown' check (gender in ('male','female','unknown')),
  email text not null,
  company text,
  position text,
  title text,
  language text not null default 'vi',
  status text not null default 'active',
  birth_date date,
  greeting_type text not null default 'ecard_only' check (greeting_type in ('ecard_only','gift_visit')),
  station text not null default 'SGN' check (station in ('SGN','HAN')),
  gift_suggestion text,
  gift_budget numeric,
  ecard_sent boolean not null default false,
  gift_given boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_birth_date_idx on public.customers (birth_date);
create index if not exists customers_deleted_idx on public.customers (deleted_at);

-- ---------------------------------------------------------------------
-- templates (email templates, versioned)
-- ---------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  current_version int not null default 1,
  versions jsonb not null default '[]'::jsonb,
  signature_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- signatures — image stored as base64 data URI inside html_content
-- (small enough that a Storage bucket isn't needed for these).
-- ---------------------------------------------------------------------
create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html_content text not null,
  is_default boolean not null default false,
  version_number int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- card_templates — birthday card background images live in Supabase
-- Storage (bucket "card-templates"); this row stores the path + the
-- calibrated text position/font.
-- ---------------------------------------------------------------------
create table if not exists public.card_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null check (gender in ('male','female')),
  image_path text not null,
  name_position jsonb not null,
  font jsonb not null,
  message_box jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- history — one row per generated email or card
-- ---------------------------------------------------------------------
create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('email','card')),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  gender text not null,
  language text not null,
  template_id text,
  generated_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists history_type_idx on public.history (type);

-- ---------------------------------------------------------------------
-- settings — simple key/value store (theme, default language, logo, …)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security — every table requires a logged-in user (no
-- anonymous/public access). Any authenticated team member can read/
-- write app data; role-based UI restrictions (admin/manager/user) are
-- enforced in the app itself, matching how the app was designed.
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.customers      enable row level security;
alter table public.templates      enable row level security;
alter table public.signatures     enable row level security;
alter table public.card_templates enable row level security;
alter table public.history        enable row level security;
alter table public.settings       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['customers','templates','signatures','card_templates','history','settings']
  loop
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format(
      'create policy "authenticated_all" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;

-- profiles: everyone authenticated can read (needed to show the Admin
-- user list and to look up your own role after login); only admins can
-- insert/update/delete (normal writes go through the create-user Edge
-- Function using the service role key, which bypasses RLS anyway).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (auth.role() = 'authenticated');

-- Admin-write check goes through a SECURITY DEFINER function rather than
-- a direct subquery on profiles — a policy that queries its own table
-- directly re-triggers RLS evaluation on itself and causes Postgres to
-- report "infinite recursion detected in policy for relation profiles".
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- Storage bucket for card template backgrounds (public-read is fine —
-- these are just decorative birthday card PNGs, nothing sensitive).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('card-templates', 'card-templates', true)
on conflict (id) do nothing;

drop policy if exists "card_templates_read" on storage.objects;
create policy "card_templates_read" on storage.objects for select using (bucket_id = 'card-templates');

drop policy if exists "card_templates_write" on storage.objects;
create policy "card_templates_write" on storage.objects for insert with check (bucket_id = 'card-templates' and auth.role() = 'authenticated');

drop policy if exists "card_templates_update" on storage.objects;
create policy "card_templates_update" on storage.objects for update using (bucket_id = 'card-templates' and auth.role() = 'authenticated');

drop policy if exists "card_templates_delete" on storage.objects;
create policy "card_templates_delete" on storage.objects for delete using (bucket_id = 'card-templates' and auth.role() = 'authenticated');

-- =====================================================================
-- Bootstrap: run this AFTER creating your own login in
-- Authentication → Users → Add User (see setup guide). Replace the
-- email below with the one you used, then run just this last part.
-- =====================================================================
-- insert into public.profiles (id, email, display_name, role)
-- select id, email, 'Lưu Cảnh Tân', 'admin'
-- from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict (id) do update set role = 'admin';
