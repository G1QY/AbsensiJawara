-- Menyatukan dependency forgot-password dan private attendance storage
-- ke jalur migration Supabase yang benar.

create table if not exists public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_otps_email_used
  on public.password_reset_otps (email, used)
  where used = false;

alter table public.password_reset_otps enable row level security;
revoke all on public.password_reset_otps from anon, authenticated;

comment on table public.password_reset_otps is
  'OTP reset password ter-hash. Hanya backend service role yang boleh mengakses.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotosnaps-private', 'fotosnaps-private', false, 8388608, array['image/jpeg', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
