-- Payroll is calculated by the authenticated server. Browser clients cannot write
-- policies, adjustments or final slips through the Supabase Data API.
begin;
create table public.payroll_policies (
 period date primary key check (extract(day from period)=1),
 monthly_basis text not null check (monthly_basis in ('MONTHLY','PER_ATTENDANCE')),
 late_rate bigint not null check (late_rate between 0 and 9999999999),
 late_rounding text not null check (late_rounding in ('MINUTE','HOUR_CEIL')),
 overtime_rate bigint not null check (overtime_rate between 0 and 9999999999),
 absence_mode text not null check (absence_mode in ('NONE','SCHEDULED','FIXED')),
 absence_rate bigint not null check (absence_rate between 0 and 9999999999),
 event_basis text not null check (event_basis in ('PER_ATTENDANCE','PER_EVENT')),
 updated_by uuid references public.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table public.payroll_adjustments (
 period date not null check (extract(day from period)=1),
 crew_id uuid not null references public.crew(id) on delete cascade,
 scope_key text not null,
 rate_override bigint check (rate_override between 0 and 9999999999),
 allowance bigint not null default 0 check (allowance between 0 and 9999999999),
 deduction bigint not null default 0 check (deduction between 0 and 9999999999),
 note text not null default '' check (length(note)<=1000),
 updated_by uuid references public.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(period,crew_id,scope_key)
);
create index payroll_adjustments_crew_idx on public.payroll_adjustments(crew_id,period);
create table public.payroll_slips (
 id uuid primary key default gen_random_uuid(),
 period date not null check (extract(day from period)=1),
 crew_id uuid references public.crew(id) on delete set null,
 user_id uuid references public.users(id) on delete set null,
 scope_key text not null,
 snapshot jsonb not null,
 status text not null default 'FINAL' check(status in ('FINAL','PAID')),
 finalized_by uuid references public.users(id) on delete set null,
 finalized_at timestamptz not null default now(),
 paid_by uuid references public.users(id) on delete set null,
 paid_at timestamptz,
 paid_date date,
 payment_reference text not null default '' check(length(payment_reference)<=200),
 unique(period,crew_id,scope_key)
);
create index payroll_slips_user_period_idx on public.payroll_slips(user_id,period);
create index payroll_slips_crew_idx on public.payroll_slips(crew_id);
do $$ declare t text; begin
 foreach t in array array['payroll_policies','payroll_adjustments','payroll_slips'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.crew,public.users,public.roles,public.user_roles,public.branches,
 public.store_assignments,public.stores,public.event_assignments,public.events,
 public.attendance_logs,public.store_schedules,public.event_schedules,public.permissions to service_role;
grant insert on public.audit_logs,public.notifications to service_role;

-- One statement reads a consistent, uncapped source snapshot. Only payroll
-- columns are returned. p_user scopes every collection for the personal API.
create function public.payroll_source(p_period date,p_user uuid default null)
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
  'permissions',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.permissions p join people c on c.id=p.crew_id where p.start_date<(p_period+interval '1 month') and p.end_date>=p_period),'[]'),
  'policy',(select to_jsonb(p) from public.payroll_policies p where p.period=p_period),
  'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.crew_id,a.scope_key) from public.payroll_adjustments a join people c on c.id=a.crew_id where a.period=p_period),'[]'),
  'slips',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.payroll_slips s where s.period=p_period and (p_user is null or s.user_id=p_user)),'[]')
 );
$$;
create function public.payroll_workspace(p_period date,p_user uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('source',src,'revision',md5(src::text)) from (select public.payroll_source(p_period,p_user) src) t;
$$;

-- Service-only mutation with actor validation, optimistic concurrency, immutable
-- paid slips and audit in the SAME transaction as each write.
create function public.mutate_payroll(p_actor uuid,p_action text,p_period date,p_revision text,p_data jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare target_crew uuid; scope text; result uuid; old_slip public.payroll_slips; src jsonb; target_user uuid;
begin
 if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
  raise exception 'Hanya Super Admin dapat mengatur payroll.' using errcode='42501';
 end if;
 if extract(day from p_period)<>1 then raise exception 'Periode tidak valid.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||p_period::text,0));
 src:=public.payroll_source(p_period,null);
 if p_revision is distinct from md5(src::text) then raise exception 'Data payroll berubah. Muat ulang sebelum menyimpan.' using errcode='40001'; end if;
 if p_action='POLICY' then
  insert into public.payroll_policies(period,monthly_basis,late_rate,late_rounding,overtime_rate,absence_mode,absence_rate,event_basis,updated_by)
  values(p_period,p_data->>'monthly_basis',(p_data->>'late_rate')::bigint,p_data->>'late_rounding',(p_data->>'overtime_rate')::bigint,p_data->>'absence_mode',(p_data->>'absence_rate')::bigint,p_data->>'event_basis',p_actor)
  on conflict(period) do update set monthly_basis=excluded.monthly_basis,late_rate=excluded.late_rate,late_rounding=excluded.late_rounding,overtime_rate=excluded.overtime_rate,absence_mode=excluded.absence_mode,absence_rate=excluded.absence_rate,event_basis=excluded.event_basis,updated_by=p_actor,updated_at=clock_timestamp();
 elsif p_action in ('ADJUSTMENT','FINALIZE') then
  target_crew:=(p_data->>'crewId')::uuid; scope:=p_data->>'scopeKey';
  select user_id into target_user from public.crew where id=target_crew and deleted_at is null;
  if target_user is null then raise exception 'Karyawan tidak tersedia.'; end if;
  if exists(select 1 from public.payroll_slips where period=p_period and crew_id=target_crew and scope_key=scope) then
   raise exception 'Payroll sudah final. Buka kembali sebelum mengubahnya.' using errcode='40001';
  end if;
  if scope is null or (scope<>'MONTHLY' and not exists(select 1 from public.event_assignments where crew_id=target_crew and event_id::text=scope)) then raise exception 'Penempatan payroll tidak valid.'; end if;
  if p_action='ADJUSTMENT' then
   if ((p_data->>'allowance')::bigint>0 or (p_data->>'deduction')::bigint>0 or p_data->>'rate_override' is not null) and length(trim(coalesce(p_data->>'note','')))=0 then raise exception 'Catatan penyesuaian wajib diisi.'; end if;
   insert into public.payroll_adjustments(period,crew_id,scope_key,rate_override,allowance,deduction,note,updated_by)
   values(p_period,target_crew,scope,(p_data->>'rate_override')::bigint,(p_data->>'allowance')::bigint,(p_data->>'deduction')::bigint,trim(p_data->>'note'),p_actor)
   on conflict(period,crew_id,scope_key) do update set rate_override=excluded.rate_override,allowance=excluded.allowance,deduction=excluded.deduction,note=excluded.note,updated_by=p_actor,updated_at=clock_timestamp();
  else
   if not exists(select 1 from public.payroll_policies where period=p_period) then raise exception 'Simpan aturan payroll terlebih dahulu.'; end if;
   if (p_data->>'total')::numeric<0 or p_data->>'blockedReason' is not null then raise exception 'Payroll belum dapat difinalkan.'; end if;
   insert into public.payroll_slips(period,crew_id,user_id,scope_key,snapshot,finalized_by) values(p_period,target_crew,target_user,scope,p_data,p_actor) returning id into result;
   insert into public.notifications(user_id,type,title,body) values(target_user,'PAYROLL','Payroll sudah final','Payroll periode '||to_char(p_period,'YYYY-MM')||' tersedia di menu Payroll Saya.');
  end if;
 elsif p_action in ('PAID','REOPEN') then
  select * into old_slip from public.payroll_slips where id=(p_data->>'id')::uuid and period=p_period for update;
  if old_slip.id is null then raise exception 'Slip tidak ditemukan.'; end if;
  if old_slip.status='PAID' then raise exception 'Payroll sudah dibayar dan tidak dapat diubah.' using errcode='40001'; end if;
  result:=old_slip.id;
  if p_action='REOPEN' then
   if length(trim(coalesce(p_data->>'note','')))<5 then raise exception 'Isi alasan membuka kembali payroll.'; end if;
   delete from public.payroll_slips where id=result;
  else
   if length(trim(coalesce(p_data->>'payment_reference','')))<3 or (p_data->>'paid_date')::date is null or (p_data->>'paid_date')::date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal dan referensi pembayaran wajib valid.'; end if;
   update public.payroll_slips set status='PAID',paid_by=p_actor,paid_at=clock_timestamp(),paid_date=(p_data->>'paid_date')::date,payment_reference=trim(p_data->>'payment_reference') where id=result;
  end if;
  if old_slip.user_id is not null then insert into public.notifications(user_id,type,title,body) values(old_slip.user_id,'PAYROLL',case when p_action='PAID' then 'Payroll ditandai dibayar' else 'Payroll dibuka kembali' end,'Periksa rincian periode '||to_char(p_period,'YYYY-MM')||' di menu Payroll Saya.'); end if;
 else raise exception 'Aksi payroll tidak valid.';
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
 values(p_actor,'PAYROLL_'||p_action,'payroll',result,case when old_slip.id is not null then to_jsonb(old_slip) else null end,jsonb_build_object('period',p_period,'data',p_data));
 return result;
end;
$$;
revoke all on function public.payroll_source(date,uuid),public.payroll_workspace(date,uuid),public.mutate_payroll(uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.payroll_source(date,uuid),public.payroll_workspace(date,uuid),public.mutate_payroll(uuid,text,date,text,jsonb) to service_role;
commit;
