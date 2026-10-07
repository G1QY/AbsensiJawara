begin;

-- An approved day off is an explicit exception to work obligations. Keep the
-- original schedule so restoring a working day does not lose its shift.
alter table public.permissions drop constraint if exists permissions_type_check;
alter table public.permissions add constraint permissions_type_check
  check (type in ('SICK','LEAVE','PERMIT','OTHER','DAY_OFF'));
alter table public.permissions add column if not exists admin_managed boolean not null default false;
create unique index if not exists permissions_admin_day
  on public.permissions(crew_id,start_date) where admin_managed and status='APPROVED';
revoke insert,update,delete on public.permissions from anon,authenticated;
grant select,insert,update,delete on public.permissions to service_role;

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
      select generate_series(date_trunc('month',first_day),date_trunc('month',last_day),interval '1 month') d
      union select date_trunc('month',coalesce((to_jsonb(e)->>'end_date')::date,e.event_date))
      from public.events e join public.event_assignments a on a.event_id=e.id
      where a.crew_id=person and e.event_date<=last_day and coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)>=first_day
    ) periods order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('payroll:'||pay_period::text,0));
  end loop;
  if exists(select 1 from public.payroll_slips s where s.crew_id=person and
    ((s.scope_key='MONTHLY' and s.period<=last_day and (s.period+interval '1 month')::date>first_day)
    or exists(select 1 from public.events e where e.id::text=s.scope_key and e.event_date<=last_day and coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)>=first_day))) then
    raise exception 'Payroll tanggal ini sudah final. Buka kembali slip sebelum mengubah libur atau izin.' using errcode='40001';
  end if;
  if exists(select 1 from public.attendance_logs where crew_id=person and attendance_date between first_day and last_day and check_in is not null) then
    raise exception 'Tanggal sudah memiliki absensi. Libur atau izin tidak dapat diubah.' using errcode='23P01';
  end if;
  if new.status in ('APPROVED','PENDING') and exists(select 1 from public.permissions p
    where p.crew_id=person and p.id<>new.id and p.status in ('APPROVED','PENDING') and p.start_date<=last_day and p.end_date>=first_day) then
    raise exception 'Tanggal bertumpuk dengan izin atau libur lain.' using errcode='23P01';
  end if;
  return new;
end $$;
revoke all on function private.guard_permission_day() from public,anon,authenticated;
create trigger guard_permission_day before insert or update on public.permissions
  for each row execute function private.guard_permission_day();

create or replace function private.guard_attendance_day_off() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.check_in is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.crew_id::text,2513));
  if exists(select 1 from public.permissions p where p.crew_id=new.crew_id and p.status='APPROVED'
    and new.attendance_date between p.start_date and p.end_date) then
    raise exception 'Tanggal ini ditetapkan libur atau izin. Hubungi admin untuk mengaktifkan jadwal.' using errcode='23P01';
  end if;
  return new;
end $$;
revoke all on function private.guard_attendance_day_off() from public,anon,authenticated;
create trigger guard_attendance_day_off before insert or update of crew_id,attendance_date,check_in on public.attendance_logs
  for each row execute function private.guard_attendance_day_off();

create or replace function public.set_crew_day_status(p_actor uuid,p_crew uuid,p_start date,p_end date,p_type text,p_reason text)
returns integer language plpgsql security invoker set search_path='' as $$
declare day date; existing public.permissions; saved uuid; total integer:=0;
begin
  if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
    raise exception 'Hanya Super Admin yang dapat mengatur libur atau izin.' using errcode='42501';
  end if;
  if not exists(select 1 from public.crew where id=p_crew and deleted_at is null and status='ACTIVE') then raise exception 'Crew aktif tidak ditemukan.'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 or p_type is null or p_type not in ('DAY_OFF','PERMIT','WORK') then raise exception 'Pilihan tanggal atau status tidak valid.'; end if;
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

-- Reuse the validated payroll mutation in one transaction. Any stale/final row
-- rolls back the entire selection; no partially saved set of crew adjustments.
create or replace function public.mutate_payroll_adjustments(p_actor uuid,p_period date,p_revision text,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; total integer:=0;
begin
  if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
    raise exception 'Hanya Super Admin yang dapat mengatur payroll.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Pilih 1 sampai 500 draft payroll.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payroll:'||p_period::text,0));
  if p_revision is distinct from md5(public.payroll_source(p_period,null)::text) then raise exception 'Data payroll berubah. Muat ulang.' using errcode='40001'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    perform public.mutate_payroll(p_actor,'ADJUSTMENT',p_period,md5(public.payroll_source(p_period,null)::text),item);
    total:=total+1;
  end loop;
  return total;
end $$;
revoke all on function public.mutate_payroll_adjustments(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_payroll_adjustments(uuid,date,text,jsonb) to service_role;
create or replace function public.payroll_source(p_period date,p_user uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with people as (
  select c.id,c.user_id,c.employee_code,c.crew_type,c.status,c.base_salary,c.company_name,c.job_title,c.division,c.join_date,
   u.full_name,u.email,coalesce(b.name,'') branch_name,coalesce(b.city_name,'') city_name,
   coalesce((select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=u.id order by r.code limit 1),c.crew_type) role
  from public.crew c join public.users u on u.id=c.user_id left join public.branches b on b.id=c.branch_id
  where c.deleted_at is null and (p_user is null or c.user_id=p_user)
   and not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=u.id and r.code='SUPER_ADMIN')
 ), placements as (
  select a.id,a.crew_id,a.start_date,
   least(a.end_date,(select min(a2.start_date)-1 from public.store_assignments a2 where a2.crew_id=a.crew_id and a2.id<>a.id and
    (a2.start_date>a.start_date or (a.status='ENDED' and a2.status='ACTIVE' and a2.start_date=a.start_date)))) end_date,
   a.status,s.id store_id,s.name,coalesce(s.location_kind,'STORE') location_kind
  from public.store_assignments a join people c on c.id=a.crew_id join public.stores s on s.id=a.store_id
  where a.start_date<(p_period+interval '1 month') and (a.end_date is null or a.end_date>=p_period)
 ), assignments as (
  select a.id,a.crew_id,a.event_id,a.status,a.position,e.event_name,e.event_date,e.status event_status,
   coalesce((to_jsonb(e)->>'end_date')::date,e.event_date) end_date
  from public.event_assignments a join people c on c.id=a.crew_id join public.events e on e.id=a.event_id
  where coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)>=p_period
    and coalesce((to_jsonb(e)->>'end_date')::date,e.event_date)<(p_period+interval '1 month')
 ), logs as (
  select a.id,a.crew_id,a.attendance_date,a.store_schedule_id,a.store_assignment_id,a.event_assignment_id,a.event_schedule_id,
   a.check_in,a.check_out,a.status,a.late_minutes,a.overtime_minutes,a.review_status,a.overtime_status
  from public.attendance_logs a join people c on c.id=a.crew_id
  where (a.attendance_date>=p_period and a.attendance_date<(p_period+interval '1 month'))
    or a.event_assignment_id in (select id from assignments)
 ), schedules as (
  select s.id,a.crew_id,s.schedule_date,s.start_time,s.end_time,s.shift_number,a.store_id,a.name,a.location_kind,a.status assignment_status
  from public.store_schedules s join placements a on a.id=s.store_assignment_id
  where s.schedule_date>=p_period and s.schedule_date<(p_period+interval '1 month')
    and (exists(select 1 from public.attendance_logs recorded where recorded.store_schedule_id=s.id)
      or (s.schedule_date>=a.start_date and (a.end_date is null or s.schedule_date<=a.end_date)
        and (a.status='ACTIVE' or a.end_date is not null)))
 ), event_schedules as (
  select s.id,a.crew_id,a.event_id,s.schedule_date,s.start_time,s.end_time,s.status
  from public.event_schedules s join assignments a on a.id=s.event_assignment_id
 )
 select jsonb_build_object(
  'people',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from people c),'[]'),
  'placements',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from placements a),'[]'),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from assignments a),'[]'),
  'attendance',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from logs a),'[]'),
  'schedules',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from schedules s),'[]'),
  'eventSchedules',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from event_schedules s),'[]'),
  'permissions',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.permissions p join people c on c.id=p.crew_id where (p.start_date<(p_period+interval '1 month') and p.end_date>=p_period) or exists(select 1 from assignments a where a.crew_id=p.crew_id and a.event_date<=p.end_date and coalesce(a.end_date,a.event_date)>=p.start_date)),'[]'),
  'policy',(select to_jsonb(p) from public.payroll_policies p where p.period=p_period),
  'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.crew_id,a.scope_key) from public.payroll_adjustments a join people c on c.id=a.crew_id where a.period=p_period),'[]'),
  'slips',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.payroll_slips s where s.period=p_period and (p_user is null or s.user_id=p_user)),'[]')
 );
$$;
notify pgrst,'reload schema';
commit;
