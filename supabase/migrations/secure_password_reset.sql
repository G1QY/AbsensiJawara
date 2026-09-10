alter table public.password_reset_otps
  add column if not exists verified_at timestamptz,
  add column if not exists reset_token_hash text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists attempts smallint not null default 0;

create index if not exists idx_password_reset_otps_reset_token
  on public.password_reset_otps (reset_token_hash)
  where used = false and reset_token_hash is not null;
