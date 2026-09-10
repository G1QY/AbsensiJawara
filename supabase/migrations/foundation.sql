-- =====================================================================
-- 001_foundation.sql — FotoSnaps DB (arsitektur: 1 perusahaan = 1 database)
-- roles, users (profil terhubung ke auth.users), user_roles, crew
--
-- Alur:
--   Supabase Auth (auth.users) -> users (profil publik) -> user_roles -> roles
--   users -> crew
--
-- TIDAK memakai tenants / user_tenants / tenant_id — database ini sudah
-- khusus untuk satu perusahaan (FotoSnaps).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- roles: 5 role baku
-- ---------------------------------------------------------------------
create table roles (
  id           uuid primary key default gen_random_uuid(),
  code         varchar(30) not null unique check (code in (
                 'SUPER_ADMIN', 'ADMIN_STORE', 'CREW_STORE', 'EVENT_MANAGER', 'CREW_EVENT'
               )),
  name         varchar(100) not null,
  description  text
);

-- ---------------------------------------------------------------------
-- users: profil publik, 1:1 dengan auth.users (Supabase Auth yang pegang
-- password/session, bukan tabel ini). id SENGAJA memakai id yang sama
-- dengan auth.users.id supaya auth.uid() di RLS bisa langsung dipakai
-- sebagai users.id tanpa join tambahan.
-- ---------------------------------------------------------------------
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     varchar(150) not null,
  email         varchar(150) not null unique,
  phone_number  varchar(30),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger: begitu ada akun baru dibuat di Supabase Auth (lewat
-- supabase.auth.admin.createUser di backend), otomatis bikinkan baris
-- profil di public.users. full_name & phone_number diambil dari
-- `raw_user_meta_data` yang dikirim backend saat createUser.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'phone_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- user_roles: role yang dimiliki user (biasanya satu, tapi struktur
-- mendukung lebih dari satu kalau suatu saat dibutuhkan)
-- ---------------------------------------------------------------------
create table user_roles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  role_id      uuid not null references roles(id),
  created_at   timestamptz not null default now(),
  unique (user_id, role_id)
);

-- ---------------------------------------------------------------------
-- crew: profil pekerja (Crew Store / Crew Event)
-- ---------------------------------------------------------------------
create table crew (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  employee_code  varchar(30) not null unique,
  crew_type      varchar(20) not null check (crew_type in ('CREW_STORE', 'CREW_EVENT')),
  join_date      date not null,
  status         varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  base_salary    numeric(12, 2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_user_roles_user on user_roles(user_id);
create index idx_crew_user on crew(user_id);
create index idx_crew_status on crew(status);

-- ---------------------------------------------------------------------
-- Fungsi bantu RLS: cek apakah user yang sedang login adalah admin
-- (SUPER_ADMIN / ADMIN_STORE / EVENT_MANAGER). Dipakai berulang di
-- 005_audit_rls.sql.
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = uid
      and r.code in ('SUPER_ADMIN', 'ADMIN_STORE', 'EVENT_MANAGER')
  );
$$;
