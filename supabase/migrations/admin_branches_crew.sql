-- Run after migrations 001-009. No real stores/events are invented here.
begin;
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  name varchar(150) not null,
  created_at timestamptz not null default now()
);
insert into public.branches (code, name) values
  ('JKT', 'Jakarta'), ('YGY', 'Yogyakarta'), ('BDG', 'Bandung'), ('TSM', 'Tasikmalaya');
alter table public.stores add column branch_id uuid references public.branches(id);
alter table public.events add column branch_id uuid references public.branches(id);
alter table public.crew add column branch_id uuid references public.branches(id), add column deleted_at timestamptz;
create index idx_stores_branch on public.stores(branch_id);
create index idx_events_branch on public.events(branch_id);
create index idx_crew_branch on public.crew(branch_id);
alter table public.branches enable row level security;
create policy branches_read on public.branches for select to authenticated using (auth.uid() is not null);
-- Writes only through authenticated admin backend; never anon access.
grant select on public.branches to authenticated;
grant all on public.branches to service_role;
-- Do not let a direct Data API request re-enable its own disabled profile.
-- Profile edits in this app go through /users/me using the server service role.
revoke update on public.users from anon, authenticated;

-- One transaction for profile, role, salary, assignments, status and audit.
-- Only the server service-role may invoke this RPC; passwords never enter it.
create function public.manage_crew(p_actor_id uuid, p_operation text, p_crew_id uuid, p_user_id uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  c public.crew%rowtype;
  old_c jsonb;
  target_user uuid;
  target_branch uuid;
  target_type text;
  location_id uuid;
  location_branch uuid;
  role_id_value uuid;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
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
  if target_user=p_actor_id or public.is_admin(target_user) then raise exception 'Akun admin tidak boleh diubah lewat Kelola Crew.' using errcode='42501'; end if;
  if p_operation='archive' then
    update public.crew set deleted_at=now(), status='INACTIVE', updated_at=now() where id=c.id;
    update public.users set is_active=false, updated_at=now() where id=target_user;
    update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
    update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  else
    target_type := coalesce(p_data->>'crewType', c.crew_type);
    target_branch := case when p_data ? 'branchId' then nullif(p_data->>'branchId','')::uuid else c.branch_id end;
    location_id := nullif(p_data->>'assignTo','')::uuid;
    if target_type not in ('CREW_EVENT','CREW_STORE') then raise exception 'Jenis crew tidak valid.'; end if;
    if target_branch is not null and not exists(select 1 from public.branches where id=target_branch) then raise exception 'Cabang tidak ditemukan.'; end if;
    if p_data ? 'baseSalary' and ((p_data->>'baseSalary')::numeric < 0 or (p_data->>'baseSalary')::numeric > 9999999999) then raise exception 'Gaji pokok tidak valid.'; end if;
    if location_id is not null then
      if target_type='CREW_STORE' then
        select branch_id into location_branch from public.stores where id=location_id and status='ACTIVE' for share;
      else
        select branch_id into location_branch from public.events where id=location_id and status in ('SCHEDULED','ONGOING') for share;
      end if;
      if not found or location_branch is null or target_branch is distinct from location_branch then
        raise exception 'Pilih store/event aktif yang sudah terhubung dengan cabang crew.';
      end if;
      if target_type='CREW_EVENT' and length(trim(coalesce(p_data->>'position','')))=0 then raise exception 'Posisi tugas event wajib diisi.'; end if;
    end if;
    if p_operation='create' then
      insert into public.crew(user_id, employee_code, crew_type, join_date, status, base_salary, branch_id)
      values(target_user,p_data->>'employeeCode',target_type,today,coalesce(p_data->>'status','ACTIVE'),coalesce((p_data->>'baseSalary')::numeric,0),target_branch)
      returning * into c;
    else
      if target_type<>c.crew_type then
        update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
        update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
      end if;
      update public.crew set employee_code=coalesce(p_data->>'employeeCode',employee_code), crew_type=target_type,
        base_salary=coalesce((p_data->>'baseSalary')::numeric,base_salary), status=coalesce(p_data->>'status',status), branch_id=target_branch, updated_at=now()
      where id=c.id returning * into c;
    end if;
    update public.users set full_name=coalesce(p_data->>'fullName',full_name), phone_number=coalesce(p_data->>'phoneNumber',phone_number),
      is_active=(c.status='ACTIVE'), updated_at=now() where id=target_user;
    select id into role_id_value from public.roles where code=target_type;
    if role_id_value is null then raise exception 'Role crew belum tersedia. Jalankan seed roles.'; end if;
    delete from public.user_roles where user_id=target_user;
    insert into public.user_roles(user_id,role_id) values(target_user,role_id_value);
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
    jsonb_build_object('employee_code',c.employee_code,'branch_id',c.branch_id,'operation',p_operation,'assignTo',p_data->>'assignTo'));
  return c.id;
end;
$$;
revoke all on function public.manage_crew(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.manage_crew(uuid,text,uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
