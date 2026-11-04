begin;

alter table public.store_schedules add column break_start_time time, add column break_end_time time;
alter table public.event_schedules add column break_start_time time, add column break_end_time time;
alter table public.attendance_logs
  add column break_started_at timestamptz, add column break_ended_at timestamptz,
  add column break_start_photo_url text, add column break_end_photo_url text,
  add column break_start_lat numeric, add column break_start_lng numeric,
  add column break_end_lat numeric, add column break_end_lng numeric;

-- Keep schedule edits and attendance evidence serialized on the same crew lock.
create or replace function private.guard_shift_break() returns trigger
language plpgsql security invoker set search_path='' as $$
declare person uuid; shift_length interval; begins interval; ends interval;
begin
  if tg_table_name='store_schedules' then
    select crew_id into person from public.store_assignments where id=new.store_assignment_id;
  else
    select crew_id into person from public.event_assignments where id=new.event_assignment_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(person::text,2513));
  if tg_op='UPDATE' and row(new.start_time,new.end_time,new.break_start_time,new.break_end_time)
    is distinct from row(old.start_time,old.end_time,old.break_start_time,old.break_end_time)
    and exists(select 1 from public.attendance_logs a where
      (tg_table_name='store_schedules' and a.store_schedule_id=new.id)
      or (tg_table_name='event_schedules' and a.event_schedule_id=new.id)) then
    raise exception 'Jadwal sudah dipakai untuk absensi dan tidak dapat diubah.' using errcode='23P01';
  end if;
  if new.break_start_time is null and new.break_end_time is null then return new; end if;
  if new.break_start_time is null or new.break_end_time is null then
    raise exception 'Isi jam mulai dan selesai istirahat.' using errcode='23514';
  end if;
  shift_length:=new.end_time-new.start_time;
  if shift_length<=interval '0' then shift_length:=shift_length+interval '1 day'; end if;
  begins:=new.break_start_time-new.start_time;
  if begins<interval '0' then begins:=begins+interval '1 day'; end if;
  ends:=new.break_end_time-new.start_time;
  if ends<interval '0' then ends:=ends+interval '1 day'; end if;
  if not (begins>interval '0' and ends>begins and ends<shift_length) then
    raise exception 'Istirahat harus berada di dalam shift.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_shift_break() from public,anon,authenticated;
create trigger guard_shift_break before insert or update on public.store_schedules
  for each row execute function private.guard_shift_break();
create trigger guard_shift_break before insert or update on public.event_schedules
  for each row execute function private.guard_shift_break();

alter table public.attendance_logs add constraint attendance_break_evidence check (
  (break_started_at is null or (check_in is not null and break_started_at>=check_in
    and break_start_photo_url is not null and break_start_lat between -90 and 90 and break_start_lng between -180 and 180
    and break_start_lat is not null and break_start_lng is not null))
  and (break_ended_at is null or (break_started_at is not null and break_ended_at>=break_started_at
    and break_end_photo_url is not null and break_end_lat between -90 and 90 and break_end_lng between -180 and 180
    and break_end_lat is not null and break_end_lng is not null))
  and (check_out is null or break_started_at is null or (break_ended_at is not null and break_ended_at<=check_out))
);

create or replace function private.guard_break_evidence() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.crew_id::text,2513));
  if row(new.break_started_at,new.break_ended_at) is distinct from row(old.break_started_at,old.break_ended_at) then
    if old.check_out is not null or (old.break_started_at is not null and new.break_started_at is distinct from old.break_started_at)
      or (old.break_ended_at is not null and new.break_ended_at is distinct from old.break_ended_at) then
      raise exception 'Bukti istirahat sudah terkunci.' using errcode='40001';
    end if;
    new.review_status:='PENDING';new.reviewed_by:=null;new.reviewed_at:=null;new.review_note:='';
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
      select c.user_id,case when new.break_ended_at is not null then 'BREAK_ENDED' else 'BREAK_STARTED' end,
        'attendance_logs',new.id,jsonb_build_object('break_started_at',new.break_started_at,'break_ended_at',new.break_ended_at)
        from public.crew c where c.id=new.crew_id;
  end if;
  return new;
end $$;
revoke all on function private.guard_break_evidence() from public,anon,authenticated;
create trigger guard_break_evidence before update of break_started_at,break_ended_at on public.attendance_logs
  for each row execute function private.guard_break_evidence();

alter table public.permissions add column if not exists review_note text not null default '';
alter table public.permissions add column if not exists reviewed_by uuid references public.users(id) on delete set null;
alter table public.permissions add column if not exists reviewed_at timestamptz;

-- Existing date, attendance, overlapping-request and finalized-payroll guards
-- continue to apply to requests and decisions. These routines commit audit
-- records atomically and are callable by the server only.
create or replace function public.request_crew_permission(p_actor uuid,p_start date,p_end date,p_type text,p_reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid; saved uuid;
begin
  select c.id into person from public.crew c join public.users u on u.id=c.user_id
    where u.id=p_actor and u.is_active and c.status='ACTIVE' and c.deleted_at is null;
  if person is null then raise exception 'Profil crew aktif tidak ditemukan.' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>30
    or p_type is null or p_type not in ('SICK','PERMIT')
    or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then
    raise exception 'Pilih izin/sakit, rentang maksimal 31 hari, dan isi alasan 3–1000 karakter.' using errcode='22023';
  end if;
  insert into public.permissions(crew_id,start_date,end_date,type,reason,status,admin_managed)
    values(person,p_start,p_end,p_type,trim(p_reason),'PENDING',false) returning id into saved;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
    values(p_actor,'CREW_PERMISSION_REQUESTED','permissions',saved,jsonb_build_object('crew_id',person,'type',p_type,'start_date',p_start,'end_date',p_end));
  return saved;
end $$;

create or replace function public.review_crew_permission(p_actor uuid,p_id uuid,p_decision text,p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare existing public.permissions;
begin
  if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id
    where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
    raise exception 'Hanya Super Admin yang dapat meninjau pengajuan.' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('APPROVED','REJECTED') or length(coalesce(p_note,''))>1000
    or (p_decision='REJECTED' and length(trim(coalesce(p_note,'')))<3) then
    raise exception 'Keputusan tidak valid atau alasan penolakan belum diisi.' using errcode='22023';
  end if;
  select * into existing from public.permissions where id=p_id;
  if existing.id is null then raise exception 'Pengajuan tidak ditemukan.' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(existing.crew_id::text,2513));
  select * into existing from public.permissions where id=p_id for update;
  if existing.status<>'PENDING' or existing.admin_managed then
    raise exception 'Pengajuan sudah ditinjau. Muat ulang.' using errcode='40001';
  end if;
  update public.permissions set status=p_decision,review_note=trim(coalesce(p_note,'')),reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values(p_actor,'CREW_PERMISSION_REVIEWED','permissions',p_id,to_jsonb(existing),jsonb_build_object('status',p_decision,'review_note',p_note));
end $$;
revoke all on function public.request_crew_permission(uuid,date,date,text,text),public.review_crew_permission(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.request_crew_permission(uuid,date,date,text,text),public.review_crew_permission(uuid,uuid,text,text) to service_role;

create or replace function public.set_crew_day_status(p_actor uuid,p_crew uuid,p_start date,p_end date,p_type text,p_reason text)
returns integer language plpgsql security invoker set search_path='' as $$
declare day date; existing public.permissions; saved uuid; total integer:=0;
begin
  if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
    raise exception 'Hanya Super Admin yang dapat mengatur libur atau izin.' using errcode='42501';
  end if;
  if not exists(select 1 from public.crew where id=p_crew and deleted_at is null and status='ACTIVE') then raise exception 'Crew aktif tidak ditemukan.'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 or p_type is null or p_type not in ('DAY_OFF','PERMIT','SICK','WORK') then raise exception 'Pilihan tanggal atau status tidak valid.'; end if;
  if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then raise exception 'Isi keterangan minimal 3 dan maksimal 1000 karakter.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_crew::text,2513));
  for day in select generate_series(p_start,p_end,interval '1 day')::date loop
    select * into existing from public.permissions where crew_id=p_crew and start_date<=day and end_date>=day and status in ('APPROVED','PENDING') order by created_at limit 1 for update;
    if existing.id is not null and (not existing.admin_managed or existing.start_date<>existing.end_date) then
      raise exception 'Tanggal % memiliki pengajuan izin lain. Selesaikan pengajuan tersebut terlebih dahulu.',day using errcode='23P01';
    end if;
    saved:=null;
    if p_type='WORK' then
      if existing.id is not null then
        update public.permissions set status='REJECTED',reason=trim(p_reason) where id=existing.id returning id into saved;
      end if;
    elsif existing.id is not null then
      update public.permissions set type=p_type,reason=trim(p_reason) where id=existing.id returning id into saved;
    else
      insert into public.permissions(crew_id,start_date,end_date,type,reason,status,admin_managed)
      values(p_crew,day,day,p_type,trim(p_reason),'APPROVED',true) returning id into saved;
    end if;
    if saved is not null then
      total:=total+1;
      insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
      values(p_actor,'CREW_DAY_STATUS','permissions',saved,to_jsonb(existing),jsonb_build_object('crew_id',p_crew,'date',day,'type',p_type,'reason',trim(p_reason)));
    end if;
  end loop;
  return total;
end $$;
revoke all on function public.set_crew_day_status(uuid,uuid,date,date,text,text) from public,anon,authenticated;
grant execute on function public.set_crew_day_status(uuid,uuid,date,date,text,text) to service_role;


create or replace function private.guard_permission_day() returns trigger
language plpgsql security invoker set search_path='' as $$
declare person uuid; first_day date; last_day date; pay_period date;
begin
  person:=new.crew_id; first_day:=new.start_date; last_day:=new.end_date;
  if first_day>last_day then raise exception 'Rentang izin tidak valid.'; end if;
  if tg_op='UPDATE' and (new.crew_id<>old.crew_id or new.start_date<>old.start_date or new.end_date<>old.end_date) then
    raise exception 'Batalkan izin sebelum mengubah crew atau rentang tanggal.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(person::text,2513));
  -- Use the same period locks as payroll mutations, including cross-month events.
  for pay_period in
    select distinct d::date from (
      select generate_series(date_trunc('month',first_day),date_trunc('month',last_day)+interval '1 month',interval '1 month') d
      union select date_trunc('month',coalesce((to_jsonb(e)->>'end_date')::date,e.event_date))
      from public.events e join public.event_assignments a on a.event_id=e.id
      where a.crew_id=person and e.event_date<=last_day and coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)>=first_day
    ) periods order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('payroll:'||pay_period::text,0));
  end loop;
  if exists(select 1 from public.payroll_slips s where s.crew_id=person and
    ((s.scope_key='MONTHLY' and coalesce((s.snapshot->>'periodStart')::date,s.period)<=last_day and coalesce((s.snapshot->>'periodEnd')::date,(s.period+interval '1 month - 1 day')::date)>=first_day)
    or exists(select 1 from public.events e where e.id::text=s.scope_key and e.event_date<=last_day and coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)>=first_day))) then
    raise exception 'Payroll tanggal ini sudah final. Buka kembali slip sebelum mengubah libur atau izin.' using errcode='40001';
  end if;
  if new.status<>'REJECTED' and exists(select 1 from public.attendance_logs where crew_id=person and attendance_date between first_day and last_day and check_in is not null) then
    raise exception 'Tanggal sudah memiliki absensi. Libur atau izin tidak dapat diubah.' using errcode='23P01';
  end if;
  if new.status in ('APPROVED','PENDING') and exists(select 1 from public.permissions p
    where p.crew_id=person and p.id<>new.id and p.status in ('APPROVED','PENDING') and p.start_date<=last_day and p.end_date>=first_day) then
    raise exception 'Tanggal bertumpuk dengan izin atau libur lain.' using errcode='23P01';
  end if;
  return new;
end $$;

notify pgrst,'reload schema';
commit;
