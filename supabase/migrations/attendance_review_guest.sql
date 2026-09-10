begin;
alter table public.attendance_logs
  add column check_in_note text not null default '',
  add column check_out_note text not null default '',
  add column review_status text not null default 'NOT_REQUIRED' check (review_status in ('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  add column review_note text not null default '',
  add column reviewed_by uuid references public.users(id),
  add column reviewed_at timestamptz;
update public.attendance_logs set review_status='PENDING' where status='PENDING';
create index attendance_reviewed_by_idx on public.attendance_logs(reviewed_by);

create table public.guest_attendances (
  id uuid primary key default gen_random_uuid(),
  import_key text unique,
  submission_key uuid unique,
  legacy_id varchar(80),
  full_name varchar(150) not null,
  phone varchar(30) not null,
  crew_type text not null check(crew_type in ('CREW_EVENT','CREW_STORE')),
  store_id uuid references public.stores(id),
  event_id uuid references public.events(id),
  location_name varchar(250) not null,
  position varchar(100) not null default '',
  clock_type text not null check(clock_type in ('IN','OUT')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  time_source text not null check(time_source in ('SERVER','LEGACY_DEVICE')),
  photo_key text not null,
  latitude numeric(10,7), longitude numeric(10,7), accuracy numeric,
  address text not null default '',
  note text not null default '',
  review_status text not null default 'PENDING' check(review_status in ('PENDING','APPROVED','REJECTED')),
  review_note text not null default '',
  reviewed_by uuid references public.users(id), reviewed_at timestamptz,
  check (not (store_id is not null and event_id is not null)),
  check (time_source='LEGACY_DEVICE' or (submission_key is not null and (store_id is not null or event_id is not null)))
);
create index guest_attendances_date_idx on public.guest_attendances(occurred_at desc);
create index guest_attendances_store_idx on public.guest_attendances(store_id);
create index guest_attendances_event_idx on public.guest_attendances(event_id);
create index guest_attendances_reviewer_idx on public.guest_attendances(reviewed_by);
alter table public.guest_attendances enable row level security;
revoke all on public.guest_attendances from anon, authenticated;
grant all on public.guest_attendances to service_role;

-- Atomic, locked decision and audit. Approval never rewrites lateness.
create function public.review_attendance(p_actor uuid, p_kind text, p_id uuid, p_target text, p_decision text, p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  previous text;
  attendance_row public.attendance_logs%rowtype;
begin
  if not public.is_admin(p_actor) or not exists(select 1 from public.users where id=p_actor and is_active) then
    raise exception 'Hanya admin aktif yang dapat meninjau.' using errcode='42501';
  end if;
  if p_decision not in ('APPROVED','REJECTED') or p_kind not in ('registered','guest') or p_target not in ('attendance','overtime') then
    raise exception 'Keputusan tidak valid.';
  end if;
  if length(coalesce(p_note,''))>2000 or (p_decision='REJECTED' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Isi alasan penolakan (maksimal 2000 karakter).'; end if;
  if p_kind='guest' then
    if p_target<>'attendance' then raise exception 'Guest belum memiliki jadwal acuan untuk lembur.'; end if;
    select review_status into previous from public.guest_attendances where id=p_id for update;
  else
    select * into attendance_row from public.attendance_logs where id=p_id for update;
    previous := case when p_target='overtime' then attendance_row.overtime_status else attendance_row.review_status end;
  end if;
  if previous is null then raise exception 'Absensi tidak ditemukan.' using errcode='P0002'; end if;
  if previous=p_decision then return; end if;
  if previous<>'PENDING' then raise exception 'Data sudah ditinjau atau tidak membutuhkan tinjauan. Muat ulang.' using errcode='40001'; end if;
  if p_kind='guest' then
    update public.guest_attendances set review_status=p_decision,review_note=coalesce(p_note,''),reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  elsif p_target='overtime' then
    if attendance_row.review_status not in ('APPROVED','NOT_REQUIRED') then raise exception 'Selesaikan persetujuan absensi sebelum meninjau lembur.'; end if;
    if attendance_row.check_out is null or attendance_row.overtime_minutes<=0 or (attendance_row.store_schedule_id is null and attendance_row.event_schedule_id is null) then raise exception 'Data atau jadwal lembur belum lengkap.'; end if;
    update public.attendance_logs set overtime_status=p_decision where id=p_id;
  else
    update public.attendance_logs set review_status=p_decision,review_note=coalesce(p_note,''),reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(p_actor,upper(p_target)||'_'||p_decision,case when p_kind='guest' then 'guest_attendances' else 'attendance_logs' end,p_id,
    jsonb_build_object('status',previous),jsonb_build_object('decision',p_decision,'target',p_target,'note',coalesce(p_note,'')));
end;
$$;
revoke all on function public.review_attendance(uuid,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.review_attendance(uuid,text,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
