-- Satu jadwal hanya boleh memiliki satu catatan absensi.
-- Pembatasan ini mencegah Clock In ganda saat dua halaman mengirim bersamaan.

do $$
begin
  if exists (
    select event_schedule_id
    from public.attendance_logs
    where event_schedule_id is not null
    group by event_schedule_id
    having count(*) > 1
  ) then
    raise exception 'Terdapat absensi event ganda. Rapikan data tersebut sebelum menjalankan migrasi ini.'
      using errcode = '23505';
  end if;

  if exists (
    select store_schedule_id
    from public.attendance_logs
    where store_schedule_id is not null
    group by store_schedule_id
    having count(*) > 1
  ) then
    raise exception 'Terdapat absensi store ganda. Rapikan data tersebut sebelum menjalankan migrasi ini.'
      using errcode = '23505';
  end if;
end
$$;

create unique index if not exists uq_attendance_event_schedule
  on public.attendance_logs (event_schedule_id)
  where event_schedule_id is not null;

create unique index if not exists uq_attendance_store_schedule
  on public.attendance_logs (store_schedule_id)
  where store_schedule_id is not null;
