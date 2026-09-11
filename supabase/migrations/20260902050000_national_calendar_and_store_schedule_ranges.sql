-- Cache kalender Indonesia dari API dan pengaman satu jadwal Store per crew per tanggal.

create table if not exists public.national_holidays (
  holiday_date date primary key,
  name text not null check (char_length(trim(name)) between 1 and 200),
  kind text not null check (kind in ('NATIONAL_HOLIDAY', 'COLLECTIVE_LEAVE')),
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.national_holiday_syncs (
  year integer primary key check (year between 2020 and 2100),
  provider_url text not null check (provider_url like 'https://%'),
  synced_at timestamptz not null default now(),
  row_count integer not null check (row_count > 0)
);

alter table public.national_holidays enable row level security;
alter table public.national_holiday_syncs enable row level security;
revoke all on table public.national_holidays from anon, authenticated;
revoke all on table public.national_holiday_syncs from anon, authenticated;

do $$
begin
  if exists (
    select store_assignment_id, schedule_date
    from public.store_schedules
    group by store_assignment_id, schedule_date
    having count(*) > 1
  ) then
    raise exception 'Terdapat jadwal Store ganda. Rapikan data sebelum menjalankan migrasi kalender kerja.'
      using errcode = '23505';
  end if;
end
$$;

create unique index if not exists uq_store_schedule_assignment_date
  on public.store_schedules (store_assignment_id, schedule_date);

create or replace function public.replace_national_holidays(
  p_year integer,
  p_provider text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_year < 2020 or p_year > 2100 then
    raise exception 'Tahun kalender tidak valid.' using errcode = '22023';
  end if;
  if p_provider is null or p_provider not like 'https://%' then
    raise exception 'Provider kalender wajib menggunakan HTTPS.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Data kalender kosong atau tidak valid.' using errcode = '22023';
  end if;

  delete from public.national_holidays
  where holiday_date >= make_date(p_year, 1, 1)
    and holiday_date < make_date(p_year + 1, 1, 1);

  insert into public.national_holidays (holiday_date, name, kind, source)
  select holiday_date, trim(name), kind, p_provider
  from jsonb_to_recordset(p_rows) as item(holiday_date date, name text, kind text)
  where extract(year from holiday_date)::integer = p_year
    and char_length(trim(name)) between 1 and 200
    and kind in ('NATIONAL_HOLIDAY', 'COLLECTIVE_LEAVE');

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Tidak ada data kalender valid untuk tahun %.', p_year using errcode = '22023';
  end if;

  insert into public.national_holiday_syncs (year, provider_url, synced_at, row_count)
  values (p_year, p_provider, now(), v_count)
  on conflict (year) do update
  set provider_url = excluded.provider_url,
      synced_at = excluded.synced_at,
      row_count = excluded.row_count;

  return v_count;
end
$$;

revoke all on function public.replace_national_holidays(integer, text, jsonb) from public;
grant execute on function public.replace_national_holidays(integer, text, jsonb) to service_role;
