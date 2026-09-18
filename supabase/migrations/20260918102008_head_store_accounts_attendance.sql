begin;
-- Keep the legacy code valid for old installations; migrate existing memberships.
alter table public.roles drop constraint if exists roles_code_check;
alter table public.roles add constraint roles_code_check check(code in ('SUPER_ADMIN','HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT'));
insert into public.roles(code,name,description) values('HEAD_STORE','Head Store','Monitoring seluruh cabang, store dan crew dalam satu kota')
on conflict(code) do update set name=excluded.name,description=excluded.description;
create table if not exists public.head_store_scopes(
  user_id uuid primary key references public.users(id) on delete cascade,
  city_name text not null check(length(trim(city_name)) between 1 and 150),
  updated_at timestamptz not null default now()
);
insert into public.head_store_scopes(user_id,city_name)
select distinct on (ur.user_id) ur.user_id, trim(b.city_name) from public.user_roles ur
join public.roles r on r.id=ur.role_id join public.crew c on c.user_id=ur.user_id join public.branches b on b.id=c.branch_id
where r.code='ADMIN_STORE' and trim(b.city_name)<>'' order by ur.user_id,c.created_at desc
on conflict(user_id) do nothing;
insert into public.user_roles(user_id,role_id)
select ur.user_id,r.id from public.user_roles ur join public.roles old on old.id=ur.role_id
cross join public.roles r where old.code='ADMIN_STORE' and r.code='HEAD_STORE' on conflict do nothing;
delete from public.user_roles where role_id in(select id from public.roles where code='ADMIN_STORE');
update public.roles set name='Head Store (kode lama)',description='Gunakan HEAD_STORE; cakupan satu kota' where code='ADMIN_STORE';

-- Head Store never inherits the old global admin privileges.
create or replace function public.is_admin(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 join public.users u on u.id=ur.user_id where ur.user_id=uid and u.is_active and r.code in ('SUPER_ADMIN','EVENT_MANAGER'));
$$;
-- Keep the RLS helper callable by signed-in policies, but not anonymous clients.
revoke all on function public.is_admin(uuid) from public,anon;
grant execute on function public.is_admin(uuid) to authenticated,service_role;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;
-- Reconcile older live grants: this server-only SECURITY DEFINER RPC must not
-- bypass the new role boundary through a direct Data API request.
do $$ begin
 if to_regprocedure('public.replace_national_holidays(integer,text,jsonb)') is not null then
  revoke all on function public.replace_national_holidays(integer,text,jsonb) from public,anon,authenticated;
  grant execute on function public.replace_national_holidays(integer,text,jsonb) to service_role;
 end if;
end $$;
-- Roles can only be changed by the server's validated transaction.
revoke insert,update,delete on public.user_roles,public.roles from anon,authenticated;

create table if not exists public.crew_deletion_requests(
 user_id uuid primary key references public.users(id) on delete cascade,
 crew_id uuid not null,
 actor_id uuid references public.users(id) on delete set null,
 requested_at timestamptz not null default now()
);
alter table public.head_store_scopes enable row level security;
alter table public.crew_deletion_requests enable row level security;
revoke all on public.head_store_scopes,public.crew_deletion_requests from anon,authenticated;
grant all on public.head_store_scopes,public.crew_deletion_requests to service_role;

-- Existing read-all policies must not expose other cities through the Data API.
-- This private, non-exposed helper reads current database roles (never user_metadata).
create schema if not exists private;
create or replace function private.account_requires_server() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is null
 or not exists(select 1 from public.users where id=(select auth.uid()) and is_active)
 or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=(select auth.uid()) and r.code in ('HEAD_STORE','ADMIN_STORE'));
$$;
revoke all on function private.account_requires_server() from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.account_requires_server() to authenticated,service_role;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('drop policy if exists account_server_boundary on public.%I',t.tablename);
  execute format('create policy account_server_boundary on public.%I as restrictive for all to authenticated using (not (select private.account_requires_server())) with check (not (select private.account_requires_server()))',t.tablename);
 end loop;
end $$;

-- Nullable references to an author/reviewer must not block deletion or delete shared events.
do $$ declare f record; cols text; begin
 for f in select conrelid,conname,confrelid,conkey,confkey from pg_constraint
 where contype='f' and confrelid in ('public.users'::regclass,'public.crew'::regclass)
 and confdeltype='a' and connamespace='public'::regnamespace
 and array_length(conkey,1)=1
 and exists(select 1 from pg_attribute a where a.attrelid=conrelid and a.attnum=conkey[1]
   and ((confrelid='public.users'::regclass and a.attname in ('reviewed_by','actor_user_id','updated_by'))
     or (confrelid='public.crew'::regclass and a.attname in ('signed_by','pic_crew_id')))) loop
  select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=f.conrelid and attnum=any(f.conkey);
  if array_length(f.conkey,1)=1 then
   execute format('alter table %s alter column %s drop not null',f.conrelid::regclass,cols);
   execute format('alter table %s drop constraint %I',f.conrelid::regclass,f.conname);
   execute format('alter table %s add constraint %I foreign key (%s) references %s(id) on delete set null',f.conrelid::regclass,f.conname,cols,f.confrelid::regclass);
  end if;
 end loop;
end $$;

create or replace function public.set_account_role(p_actor uuid,p_user uuid,p_role text,p_scope_branch uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.crew%rowtype; city text; target_role uuid; previous jsonb;
begin
 perform pg_advisory_xact_lock(184621,1);
 if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then raise exception 'Hanya Super Admin dapat mengubah role.' using errcode='42501'; end if;
 if p_user=p_actor then raise exception 'Role akun sendiri tidak dapat diubah.' using errcode='42501'; end if;
 if p_role is null or p_role not in ('SUPER_ADMIN','HEAD_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT') then raise exception 'Role tidak valid.'; end if;
 select * into c from public.crew where user_id=p_user for update;
 perform 1 from public.users where id=p_user and is_active for update;
 if not found or c.deleted_at is not null or exists(select 1 from public.crew_deletion_requests where user_id=p_user) then raise exception 'Akun harus aktif dan tidak sedang dihapus.'; end if;
 if p_role in ('CREW_STORE','CREW_EVENT') and c.id is null then raise exception 'Akun ini belum memiliki profil crew. Buat melalui Tambah Crew.'; end if;
 if p_role='HEAD_STORE' then
  select trim(city_name) into city from public.branches where id=p_scope_branch;
  if city is null or city='' then raise exception 'Pilih kota cakupan Head Store.'; end if;
 end if;
 select jsonb_agg(r.code) into previous from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user;
 select id into target_role from public.roles where code=p_role;
 if target_role is null then raise exception 'Role belum tersedia.'; end if;
 -- The active super admin actor cannot remove their own role, so at least one always remains.
 delete from public.user_roles where user_id=p_user;
 insert into public.user_roles(user_id,role_id) values(p_user,target_role);
 delete from public.head_store_scopes where user_id=p_user;
 if p_role='HEAD_STORE' then insert into public.head_store_scopes(user_id,city_name) values(p_user,city); end if;
 if p_role in ('CREW_STORE','CREW_EVENT') and c.crew_type<>p_role then
  update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  update public.crew set crew_type=p_role,updated_at=now() where id=c.id;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
 values(p_actor,'ACCOUNT_ROLE_CHANGED','users',p_user,jsonb_build_object('roles',previous),jsonb_build_object('role',p_role,'city',city));
 return jsonb_build_object('role',p_role,'city',city,'message','Role tersimpan. Pengguna perlu masuk kembali untuk memperbarui menu.');
end $$;
revoke all on function public.set_account_role(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.set_account_role(uuid,uuid,text,uuid) to service_role;

create or replace function public.prepare_crew_deletion(p_actor uuid,p_crew uuid,p_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.crew%rowtype; u public.users%rowtype;
begin
 perform pg_advisory_xact_lock(184621,1);
 if not exists(select 1 from public.users x join public.user_roles ur on ur.user_id=x.id join public.roles r on r.id=ur.role_id where x.id=p_actor and x.is_active and r.code='SUPER_ADMIN') then raise exception 'Hanya Super Admin dapat menghapus crew permanen.' using errcode='42501'; end if;
 select * into c from public.crew where id=p_crew for update;
 if not found then raise exception 'Crew tidak ditemukan.' using errcode='P0002'; end if;
 select * into u from public.users where id=c.user_id for update;
 if u.id=p_actor or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=u.id and r.code='SUPER_ADMIN') then raise exception 'Akun sendiri atau Super Admin tidak dapat dihapus di sini.' using errcode='42501'; end if;
 if p_email is null or lower(trim(p_email))<>lower(u.email) then raise exception 'Email konfirmasi tidak sesuai. Muat ulang akun.'; end if;
 -- App uploads use service-owned storage. Refuse unexpected user-owned objects before deleting anything.
 if exists(select 1 from storage.objects where owner_id=u.id::text) then raise exception 'Akun masih memiliki file Storage. Pindahkan kepemilikan file sebelum menghapus akun.'; end if;
 insert into public.crew_deletion_requests(user_id,crew_id,actor_id) values(u.id,c.id,p_actor) on conflict(user_id) do nothing;
 update public.users set is_active=false,updated_at=now() where id=u.id;
 return jsonb_build_object('user_id',u.id,'crew_id',c.id);
end $$;
revoke all on function public.prepare_crew_deletion(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_crew_deletion(uuid,uuid,text) to service_role;

-- Audit successful deletion in the same transaction as the Auth cascade.
create or replace function private.audit_crew_deletion() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.crew_deletion_requests%rowtype;
begin
 select * into d from public.crew_deletion_requests where user_id=old.id;
 if found then
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(d.actor_id,'CREW_DELETED','crew',d.crew_id,jsonb_build_object('full_name',old.full_name,'email',old.email),jsonb_build_object('permanent',true));
  delete from public.password_reset_otps where lower(email)=lower(old.email);
 end if;
 return old;
end $$;
revoke all on function private.audit_crew_deletion() from public,anon,authenticated;
drop trigger if exists audit_crew_deletion on public.users;
create trigger audit_crew_deletion before delete on public.users for each row execute function private.audit_crew_deletion();

create or replace function public.head_store_workspace(p_actor uuid,p_from date,p_to date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare city text; result jsonb;
begin
 if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='HEAD_STORE') then raise exception 'Akses Head Store diperlukan.' using errcode='42501'; end if;
 select city_name into city from public.head_store_scopes where user_id=p_actor;
 if city is null then raise exception 'Kota cakupan belum ditetapkan. Hubungi Super Admin.' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>92 then raise exception 'Rentang tanggal maksimal 93 hari.'; end if;
 with scoped_branches as (select id,name,city_name from public.branches where lower(trim(city_name))=lower(trim(city))),
 scoped_stores as (select s.id,s.name,s.branch_id,s.status,s.location_kind from public.stores s join scoped_branches b on b.id=s.branch_id where s.deleted_at is null),
 crew_rows as (select c.id,c.branch_id,c.status,c.company_name,c.job_title,u.full_name,
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'branch_id',s.branch_id)) from public.store_assignments sa join scoped_stores s on s.id=sa.store_id
   where sa.crew_id=c.id and sa.status='ACTIVE' and sa.start_date<=(now() at time zone 'Asia/Jakarta')::date and (sa.end_date is null or sa.end_date>=(now() at time zone 'Asia/Jakarta')::date)), '[]'::jsonb) as stores
  from public.crew c join public.users u on u.id=c.user_id join scoped_branches b on b.id=c.branch_id
  where c.crew_type='CREW_STORE' and c.deleted_at is null),
 attendance_rows as (select a.id,a.attendance_date,a.check_in,a.check_out,a.status,a.late_minutes,a.overtime_minutes,a.overtime_status,
  u.full_name,s.id as store_id,s.name as store_name,s.branch_id,ss.start_time,ss.end_time
  from public.attendance_logs a join public.store_assignments sa on sa.id=a.store_assignment_id
  join public.stores s on s.id=sa.store_id join scoped_branches b on b.id=s.branch_id
  join public.crew c on c.id=a.crew_id join public.users u on u.id=c.user_id left join public.store_schedules ss on ss.id=a.store_schedule_id
  where a.attendance_date between p_from and p_to order by a.attendance_date desc,a.id limit 1000)
 select jsonb_build_object('city',city,'from',p_from,'to',p_to,
 'branches',coalesce((select jsonb_agg(b order by b.name) from scoped_branches b),'[]'::jsonb),
 'stores',coalesce((select jsonb_agg(s order by s.name) from scoped_stores s),'[]'::jsonb),
 'crew',coalesce((select jsonb_agg(c order by c.full_name) from crew_rows c),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(a order by a.attendance_date desc,a.id) from attendance_rows a),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.head_store_workspace(uuid,date,date) from public,anon,authenticated;
grant execute on function public.head_store_workspace(uuid,date,date) to service_role;

-- Preserve account roles when editing staff profiles.
create or replace function public.manage_crew(p_actor_id uuid, p_operation text, p_crew_id uuid, p_user_id uuid, p_data jsonb)
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
  if target_user=p_actor_id or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=target_user and r.code not in ('CREW_STORE','CREW_EVENT')) or exists(select 1 from public.crew_deletion_requests where user_id=target_user) then raise exception 'Akun admin tidak boleh diubah lewat Kelola Crew.' using errcode='42501'; end if;
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
      insert into public.crew(user_id, employee_code, crew_type, join_date, status, base_salary, branch_id, company_name, job_title)
      values(target_user,p_data->>'employeeCode',target_type,today,coalesce(p_data->>'status','ACTIVE'),coalesce((p_data->>'baseSalary')::numeric,0),target_branch,coalesce(p_data->>'companyName',''),coalesce(p_data->>'jobTitle',''))
      returning * into c;
    else
      if target_type<>c.crew_type then
        update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
        update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
      end if;
      update public.crew set employee_code=coalesce(p_data->>'employeeCode',employee_code), crew_type=target_type,
        company_name=case when p_data ? 'companyName' then coalesce(p_data->>'companyName','') else company_name end,
        job_title=case when p_data ? 'jobTitle' then coalesce(p_data->>'jobTitle','') else job_title end,
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
    jsonb_build_object('employee_code',c.employee_code,'branch_id',c.branch_id,'company_name',c.company_name,'job_title',c.job_title,'operation',p_operation,'assignTo',p_data->>'assignTo'));
  return c.id;
end;
$$;
revoke all on function public.manage_crew(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.manage_crew(uuid,text,uuid,uuid,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
