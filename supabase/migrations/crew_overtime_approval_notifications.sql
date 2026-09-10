begin;

-- Overtime is payable only when it was approved in the schedule or reviewed
-- by an administrator after clock-out. Merely staying past the scheduled end
-- never grants a bonus by itself.
alter table public.store_schedules
  add column if not exists overtime_preapproved boolean not null default false;
alter table public.event_schedules
  add column if not exists overtime_preapproved boolean not null default false;
alter table public.events
  add column if not exists overtime_preapproved boolean not null default false;

comment on column public.store_schedules.overtime_preapproved is
  'Admin approved full-hour overtime for this schedule before the shift.';
comment on column public.event_schedules.overtime_preapproved is
  'Admin approved full-hour overtime for this schedule before the shift.';

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- Keep every crew schedule in an event aligned with the event-level choice.
create or replace function public.inherit_event_overtime_preapproval()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  select e.overtime_preapproved into new.overtime_preapproved
  from public.event_assignments ea
  join public.events e on e.id=ea.event_id
  where ea.id=new.event_assignment_id;
  return new;
end;
$$;

drop trigger if exists event_schedule_overtime_inherit on public.event_schedules;
create trigger event_schedule_overtime_inherit
before insert or update of event_assignment_id on public.event_schedules
for each row execute function public.inherit_event_overtime_preapproval();

create or replace function public.propagate_event_overtime_preapproval()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.event_schedules es
  set overtime_preapproved=new.overtime_preapproved
  from public.event_assignments ea
  where ea.id=es.event_assignment_id and ea.event_id=new.id;
  return new;
end;
$$;

drop trigger if exists event_overtime_propagate on public.events;
create trigger event_overtime_propagate
after update of overtime_preapproved on public.events
for each row when (old.overtime_preapproved is distinct from new.overtime_preapproved)
execute function public.propagate_event_overtime_preapproval();

-- Atomic decision, audit, and notification for the registered crew account.
create or replace function public.review_attendance(p_actor uuid, p_kind text, p_id uuid, p_target text, p_decision text, p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  previous text;
  attendance_row public.attendance_logs%rowtype;
  crew_user_id uuid;
  decision_label text;
  notification_title text;
  notification_body text;
begin
  if not public.is_admin(p_actor) or not exists(select 1 from public.users where id=p_actor and is_active) then
    raise exception 'Hanya admin aktif yang dapat meninjau.' using errcode='42501';
  end if;
  if p_decision not in ('APPROVED','REJECTED') or p_kind not in ('registered','guest') or p_target not in ('attendance','overtime') then
    raise exception 'Keputusan tidak valid.';
  end if;
  if length(coalesce(p_note,''))>2000 or (p_decision='REJECTED' and length(trim(coalesce(p_note,'')))=0) then
    raise exception 'Isi alasan penolakan (maksimal 2000 karakter).';
  end if;
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

  if p_kind='registered' then
    select c.user_id into crew_user_id from public.crew c where c.id=attendance_row.crew_id;
    decision_label := case when p_decision='APPROVED' then 'disetujui' else 'ditolak' end;
    notification_title := case when p_target='overtime' then 'Pengajuan lembur ' else 'Absensi ' end || decision_label;
    notification_body := case when p_target='overtime'
      then format('Lembur %s jam pada %s %s.', floor(attendance_row.overtime_minutes / 60.0)::int, attendance_row.attendance_date, decision_label)
      else format('Absensi tanggal %s %s.', attendance_row.attendance_date, decision_label)
    end;
    if length(trim(coalesce(p_note,'')))>0 then notification_body := notification_body || ' Catatan admin: ' || trim(p_note); end if;
    insert into public.notifications(user_id,type,title,body)
    values(crew_user_id,case when p_target='overtime' then 'OVERTIME_REVIEW' else 'ATTENDANCE_REVIEW' end,notification_title,notification_body);
  end if;
end;
$$;

revoke all on function public.review_attendance(uuid,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.review_attendance(uuid,text,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
