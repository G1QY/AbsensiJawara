begin;

alter table public.crew
  add column assignment_kind text not null default 'STORE',
  add column attendance_location_mode text not null default 'ASSIGNED'
    check (attendance_location_mode in ('ASSIGNED','ANYWHERE'));
update public.crew c set assignment_kind=case
  when c.crew_type='CREW_EVENT' then 'EVENT'
  when exists(select 1 from public.store_assignments a join public.stores s on s.id=a.store_id
    where a.crew_id=c.id and a.status='ACTIVE' and s.location_kind='OFFICE'
    and a.start_date<=(now() at time zone 'Asia/Jakarta')::date
    and (a.end_date is null or a.end_date>=(now() at time zone 'Asia/Jakarta')::date)) then 'OFFICE'
  else 'STORE' end;
alter table public.crew add constraint crew_assignment_kind_check check (
  (crew_type='CREW_EVENT' and assignment_kind='EVENT') or
  (crew_type='CREW_STORE' and assignment_kind in ('STORE','OFFICE')));

-- Preserve legacy creators/role changes; location exceptions can only be written by the backend.
create or replace function private.guard_crew_location_policy()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and
    ((tg_op='INSERT' and new.attendance_location_mode<>'ASSIGNED') or
     (tg_op='UPDATE' and new.attendance_location_mode is distinct from old.attendance_location_mode)) then
    raise exception 'Mode lokasi hanya dapat diubah melalui admin aplikasi.' using errcode='42501';
  end if;
  if tg_op='INSERT' and new.crew_type='CREW_EVENT' and new.assignment_kind='STORE' then
    new.assignment_kind := 'EVENT';
  elsif tg_op='UPDATE' and new.crew_type<>old.crew_type and new.assignment_kind=old.assignment_kind then
    new.assignment_kind := case when new.crew_type='CREW_EVENT' then 'EVENT' else 'STORE' end;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_crew_location_policy() from public,anon,authenticated;
create trigger guard_crew_location_policy before insert or update on public.crew
  for each row execute function private.guard_crew_location_policy();

-- Remote attendance can be thousands of kilometres from its assigned location.
alter table public.attendance_logs
  alter column check_in_distance_m type numeric(12,2),
  alter column check_out_distance_m type numeric(12,2),
  add column check_in_location_mode text not null default 'ASSIGNED'
    check (check_in_location_mode in ('ASSIGNED','ANYWHERE')),
  add column check_out_location_mode text
    check (check_out_location_mode in ('ASSIGNED','ANYWHERE'));
update public.attendance_logs set check_out_location_mode='ASSIGNED' where check_out is not null;

create or replace function public.manage_crew(p_actor_id uuid, p_operation text, p_crew_id uuid, p_user_id uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  c public.crew%rowtype;
  promoted boolean;
  actor_super boolean;
  old_c jsonb;
  target_user uuid;
  target_branch uuid;
  target_type text;
  target_kind text;
  target_mode text;
  location_kind_value text;
  location_id uuid;
  location_branch uuid;
  role_id_value uuid;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  perform pg_advisory_xact_lock(184621,1);
  select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_id and r.code='SUPER_ADMIN') into actor_super;
  if not public.is_admin(p_actor_id) or not exists(select 1 from public.users where id=p_actor_id and is_active) then
    raise exception 'Akses admin diperlukan.' using errcode='42501';
  end if;
  if p_operation not in ('create','update','archive') then raise exception 'Operasi tidak valid.'; end if;
  if p_operation='create' then
    target_user := p_user_id;
    if exists(select 1 from public.crew where user_id=target_user) then raise exception 'Akun sudah memiliki profil crew.'; end if;
  else
    select * into c from public.crew where id=p_crew_id and deleted_at is null for update;
    if not found then raise exception 'Crew tidak ditemukan.' using errcode='P0002'; end if;
    target_user := c.user_id;
    old_c := to_jsonb(c);
  end if;
  select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=target_user and r.code not in ('CREW_STORE','CREW_EVENT')) into promoted;
  if target_user=p_actor_id or exists(select 1 from public.crew_deletion_requests where user_id=target_user)
    or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=target_user and r.code='SUPER_ADMIN')
    or (promoted and (not actor_super or p_operation<>'update')) then
    raise exception 'Akun admin ini tidak boleh diubah lewat Kelola Crew.' using errcode='42501';
  end if;
  if promoted and p_data ? 'crewType' and p_data->>'crewType' is distinct from c.crew_type then
    raise exception 'Gunakan Ubah role untuk mengubah jenis akun yang telah dipromosikan.';
  end if;
  if p_operation='archive' then
    update public.crew set deleted_at=now(), status='INACTIVE', updated_at=now() where id=c.id;
    update public.users set is_active=false, updated_at=now() where id=target_user;
    update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
    update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  else
    target_type := coalesce(p_data->>'crewType', c.crew_type);
    target_branch := case when p_data ? 'branchId' then nullif(p_data->>'branchId','')::uuid else c.branch_id end;
    location_id := nullif(p_data->>'assignTo','')::uuid;
    target_mode := coalesce(p_data->>'attendanceLocationMode', c.attendance_location_mode, 'ASSIGNED');
    if target_mode not in ('ASSIGNED','ANYWHERE') then raise exception 'Mode lokasi tidak valid.'; end if;
    if not actor_super and target_mode is distinct from coalesce(c.attendance_location_mode,'ASSIGNED') then
      raise exception 'Hanya Super Admin yang dapat mengubah mode lokasi absensi.' using errcode='42501';
    end if;
    if target_type not in ('CREW_EVENT','CREW_STORE') then raise exception 'Jenis crew tidak valid.'; end if;
    if target_branch is not null and not exists(select 1 from public.branches where id=target_branch) then raise exception 'Cabang tidak ditemukan.'; end if;
    if p_data ? 'baseSalary' and ((p_data->>'baseSalary')::numeric < 0 or (p_data->>'baseSalary')::numeric > 9999999999) then raise exception 'Gaji pokok tidak valid.'; end if;
    if location_id is not null then
      if target_type='CREW_STORE' then
        select branch_id,location_kind into location_branch,location_kind_value from public.stores where id=location_id and status='ACTIVE' for share;
      else
        select branch_id into location_branch from public.events where id=location_id and status in ('SCHEDULED','ONGOING') for share;
      end if;
      if not found or location_branch is null or target_branch is distinct from location_branch then
        raise exception 'Pilih store/event aktif yang sudah terhubung dengan cabang crew.';
      end if;
      if target_type='CREW_EVENT' and length(trim(coalesce(p_data->>'position','')))=0 then raise exception 'Posisi tugas event wajib diisi.'; end if;
    end if;
    target_kind := coalesce(p_data->>'assignmentKind', location_kind_value,
      case when target_type=c.crew_type then c.assignment_kind end,
      case when target_type='CREW_EVENT' then 'EVENT' else 'STORE' end);
    if target_kind not in ('EVENT','STORE','OFFICE') or (target_kind='EVENT') <> (target_type='CREW_EVENT') then
      raise exception 'Jenis penugasan tidak sesuai dengan jenis crew.';
    end if;
    if location_kind_value is not null and target_kind<>location_kind_value then
      raise exception 'Pilih lokasi sesuai jenis penugasan Store atau Kantor.';
    end if;
    if p_operation='create' then
      insert into public.crew(user_id, employee_code, crew_type, join_date, status, base_salary, branch_id, company_name, job_title, assignment_kind, attendance_location_mode)
      values(target_user,p_data->>'employeeCode',target_type,today,coalesce(p_data->>'status','ACTIVE'),coalesce((p_data->>'baseSalary')::numeric,0),target_branch,coalesce(p_data->>'companyName',''),coalesce(p_data->>'jobTitle',''),target_kind,target_mode)
      returning * into c;
    else
      if target_type<>c.crew_type then
        update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
        update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
      elsif target_kind<>c.assignment_kind then
        -- Office/store placement changes do not cancel temporary event work.
        update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
      end if;
      update public.crew set employee_code=coalesce(p_data->>'employeeCode',employee_code), crew_type=target_type, assignment_kind=target_kind, attendance_location_mode=target_mode,
        company_name=case when p_data ? 'companyName' then coalesce(p_data->>'companyName','') else company_name end,
        job_title=case when p_data ? 'jobTitle' then coalesce(p_data->>'jobTitle','') else job_title end,
        base_salary=coalesce((p_data->>'baseSalary')::numeric,base_salary), status=coalesce(p_data->>'status',status), branch_id=target_branch, updated_at=now()
      where id=c.id returning * into c;
    end if;
    update public.users set full_name=coalesce(p_data->>'fullName',full_name), phone_number=coalesce(p_data->>'phoneNumber',phone_number),
      is_active=(c.status='ACTIVE'), updated_at=now() where id=target_user;
    select id into role_id_value from public.roles where code=target_type;
    if role_id_value is null then raise exception 'Role crew belum tersedia. Jalankan seed roles.'; end if;
    if not promoted then
      delete from public.user_roles where user_id=target_user;
      insert into public.user_roles(user_id,role_id) values(target_user,role_id_value);
    end if;
    if location_id is not null then
      if target_type='CREW_STORE' then
        -- Changing store ends the previous assignment, but keeps attendance history.
        update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE' and store_id<>location_id;
        if not exists(select 1 from public.store_assignments where crew_id=c.id and store_id=location_id and status='ACTIVE' and start_date<=today and (end_date is null or end_date>=today)) then
          insert into public.store_assignments(crew_id,store_id,start_date,status) values(c.id,location_id,today,'ACTIVE');
        end if;
      else
        if not exists(select 1 from public.event_assignments where crew_id=c.id and event_id=location_id and status='ACTIVE') then
          insert into public.event_assignments(crew_id,event_id,position,status) values(c.id,location_id,p_data->>'position','ACTIVE');
        else
          update public.event_assignments set position=p_data->>'position' where crew_id=c.id and event_id=location_id and status='ACTIVE';
        end if;
      end if;
    end if;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(p_actor_id,'CREW_'||upper(p_operation),'crew',c.id,old_c,
    jsonb_build_object('employee_code',c.employee_code,'branch_id',c.branch_id,'company_name',c.company_name,'job_title',c.job_title,'assignment_kind',c.assignment_kind,'attendance_location_mode',c.attendance_location_mode,'operation',p_operation,'assignTo',p_data->>'assignTo'));
  return c.id;
end;
$$;
revoke all on function public.manage_crew(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.manage_crew(uuid,text,uuid,uuid,jsonb) to service_role;


notify pgrst, 'reload schema';
commit;
