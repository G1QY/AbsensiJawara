begin;

-- A yearly save materializes the chosen rules into the remaining monthly
-- periods. Existing monthly records and immutable slips are preserved.
alter table public.payroll_policies
  add column cutoff_day integer not null default 31 check (cutoff_day between 1 and 31),
  add column payment_day integer not null default 1 check (payment_day between 1 and 31),
  add column payment_month_offset integer not null default 1 check (payment_month_offset in (0,1)),
  add column annual_year integer check (annual_year=extract(year from period));

create function private.payroll_policy_for(p_period date,p_override jsonb default null,p_from date default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select case when p_override is not null and p_period>=p_from and extract(year from p_period)=extract(year from p_from)
    then p_override||jsonb_build_object('annual_year',extract(year from p_from))
    else (select to_jsonb(p) from public.payroll_policies p where p.period=p_period) end;
$$;

create function private.payroll_day(p_month date,p_day integer)
returns date language sql immutable security invoker set search_path='' as $$
  select p_month+least(p_day,extract(day from p_month+interval '1 month - 1 day')::integer)-1;
$$;

create function private.payroll_calendar(p_period date,p_override jsonb default null,p_from date default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  with rules as (
    select private.payroll_policy_for(p_period,p_override,p_from) current_policy,
      private.payroll_policy_for((p_period-interval '1 month')::date,p_override,p_from) previous_policy
  ) select jsonb_build_object(
    'startDate',private.payroll_day((p_period-interval '1 month')::date,coalesce((previous_policy->>'cutoff_day')::int,31))+1,
    'endDate',private.payroll_day(p_period,coalesce((current_policy->>'cutoff_day')::int,31)),
    'paymentDate',private.payroll_day((p_period+make_interval(months=>coalesce((current_policy->>'payment_month_offset')::int,1)))::date,coalesce((current_policy->>'payment_day')::int,1))
  ) from rules;
$$;

create function private.payroll_source_window(p_period date,p_user uuid,p_override jsonb,p_from date)
returns jsonb language sql stable security invoker set search_path='' as $$
 with bounds as (select private.payroll_calendar(p_period,p_override,p_from) value), people as (
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
  where a.start_date<=(select (value->>'endDate')::date from bounds) and (a.end_date is null or a.end_date>=(select (value->>'startDate')::date from bounds))
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
  where (a.attendance_date between (select (value->>'startDate')::date from bounds) and (select (value->>'endDate')::date from bounds))
    or a.event_assignment_id in (select id from assignments)
 ), schedules as (
  select s.id,a.crew_id,s.schedule_date,s.start_time,s.end_time,s.shift_number,a.store_id,a.name,a.location_kind,a.status assignment_status
  from public.store_schedules s join placements a on a.id=s.store_assignment_id
  where s.schedule_date between (select (value->>'startDate')::date from bounds) and (select (value->>'endDate')::date from bounds)
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
  'permissions',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.permissions p join people c on c.id=p.crew_id where (p.start_date<=(select (value->>'endDate')::date from bounds) and p.end_date>=(select (value->>'startDate')::date from bounds)) or exists(select 1 from assignments a where a.crew_id=p.crew_id and a.event_date<=p.end_date and coalesce(a.end_date,a.event_date)>=p.start_date)),'[]'),
  'policy',private.payroll_policy_for(p_period,p_override,p_from),
  'calendar',(select value from bounds),
  'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.crew_id,a.scope_key) from public.payroll_adjustments a join people c on c.id=a.crew_id where a.period=p_period),'[]'),
  'slips',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.payroll_slips s where s.period=p_period and (p_user is null or s.user_id=p_user)),'[]')
 );
$$;


create or replace function public.payroll_source(p_period date,p_user uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.payroll_source_window(p_period,p_user,null,null);
$$;

-- Include January of the following year: moving December's cutoff also moves
-- January's start. The revision covers that boundary and the immutable slips.
create function public.payroll_year_workspace(p_year integer,p_from_month integer,p_policy jsonb default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare first_period date; months jsonb;
begin
  if p_year is null or p_year not between 2000 and 2099 or p_from_month is null or p_from_month not between 1 and 12 then
    raise exception 'Tahun atau bulan mulai tidak valid.';
  end if;
  first_period:=make_date(p_year,p_from_month,1);
  select jsonb_agg(jsonb_build_object('month',to_char(d,'YYYY-MM'),
      'source',public.payroll_source(d::date,null),
      'previewSource',case when p_policy is not null then private.payroll_source_window(d::date,null,p_policy,first_period) else null end) order by d)
    into months from generate_series(first_period,make_date(p_year+1,1,1),interval '1 month') d;
  return jsonb_build_object('months',months,'revision',md5((select jsonb_agg(item->'source')::text from jsonb_array_elements(months) item)));
end $$;

create function public.set_payroll_year_policy(p_actor uuid,p_year integer,p_from_month integer,p_revision text,p_policy jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare first_period date; target date; old_window jsonb; new_window jsonb; old_rules jsonb; total integer:=0;
begin
  if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
    raise exception 'Hanya Super Admin dapat mengatur payroll.' using errcode='42501';
  end if;
  if p_year is null or p_year not between 2000 and 2099 or p_from_month is null or p_from_month not between 1 and 12 then raise exception 'Tahun atau bulan mulai tidak valid.'; end if;
  if p_policy is null or jsonb_typeof(p_policy)<>'object' or
    coalesce((p_policy->>'cutoff_day')::int,0) not between 1 and 31 or
    coalesce((p_policy->>'payment_day')::int,0) not between 1 and 31 or
    coalesce((p_policy->>'payment_month_offset')::int,-1) not in (0,1) then raise exception 'Pengaturan tanggal payroll tidak valid.'; end if;
  first_period:=make_date(p_year,p_from_month,1);
  -- Same lock order as monthly payroll mutations and permission changes.
  for target in select generate_series(first_period,make_date(p_year+1,1,1),interval '1 month')::date loop
    perform pg_advisory_xact_lock(hashtextextended('payroll:'||target::text,0));
  end loop;
  if p_revision is distinct from public.payroll_year_workspace(p_year,p_from_month,null)->>'revision' then
    raise exception 'Data payroll berubah. Buat pratinjau ulang.' using errcode='40001';
  end if;
  for target in select generate_series(first_period,make_date(p_year+1,1,1),interval '1 month')::date loop
    old_window:=private.payroll_calendar(target);
    new_window:=private.payroll_calendar(target,p_policy,first_period);
    if (old_window->>'startDate' is distinct from new_window->>'startDate' or old_window->>'endDate' is distinct from new_window->>'endDate')
      and exists(select 1 from public.payroll_slips where period=target and scope_key='MONTHLY') then
      raise exception 'Batas periode % terkunci karena ada slip final/dibayar. Pilih bulan mulai setelah periode terkunci.',to_char(target,'YYYY-MM');
    end if;
    if extract(year from target)=p_year and (new_window->>'paymentDate')::date<=(new_window->>'endDate')::date then
      raise exception 'Tanggal bayar % harus setelah akhir periode %. Pilih batas periode lebih awal atau bulan pembayaran berikutnya.',new_window->>'paymentDate',new_window->>'endDate';
    end if;
  end loop;
  select jsonb_agg(to_jsonb(p) order by p.period) into old_rules from public.payroll_policies p where p.period>=first_period and p.period<make_date(p_year+1,1,1);
  for target in select generate_series(first_period,make_date(p_year,12,1),interval '1 month')::date loop
    perform public.mutate_payroll(p_actor,'POLICY',target,md5(public.payroll_source(target,null)::text),p_policy);
    update public.payroll_policies set cutoff_day=(p_policy->>'cutoff_day')::int,payment_day=(p_policy->>'payment_day')::int,
      payment_month_offset=(p_policy->>'payment_month_offset')::int,annual_year=p_year where period=target;
    total:=total+1;
  end loop;
  insert into public.audit_logs(actor_user_id,action,entity_type,old_data,new_data)
    values(p_actor,'PAYROLL_YEAR_POLICY','payroll',old_rules,jsonb_build_object('year',p_year,'fromMonth',p_from_month,'policy',p_policy));
  return total;
end $$;

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
  if exists(select 1 from public.attendance_logs where crew_id=person and attendance_date between first_day and last_day and check_in is not null) then
    raise exception 'Tanggal sudah memiliki absensi. Libur atau izin tidak dapat diubah.' using errcode='23P01';
  end if;
  if new.status in ('APPROVED','PENDING') and exists(select 1 from public.permissions p
    where p.crew_id=person and p.id<>new.id and p.status in ('APPROVED','PENDING') and p.start_date<=last_day and p.end_date>=first_day) then
    raise exception 'Tanggal bertumpuk dengan izin atau libur lain.' using errcode='23P01';
  end if;
  return new;
end $$;


revoke all on function private.payroll_policy_for(date,jsonb,date),private.payroll_day(date,integer),private.payroll_calendar(date,jsonb,date),private.payroll_source_window(date,uuid,jsonb,date),public.payroll_year_workspace(integer,integer,jsonb),public.set_payroll_year_policy(uuid,integer,integer,text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.payroll_policy_for(date,jsonb,date),private.payroll_day(date,integer),private.payroll_calendar(date,jsonb,date),private.payroll_source_window(date,uuid,jsonb,date),public.payroll_year_workspace(integer,integer,jsonb),public.set_payroll_year_policy(uuid,integer,integer,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
