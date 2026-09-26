begin;
-- Only ciphertext lives in PostgreSQL. The AES key is exclusively a backend secret.
create schema if not exists private;
create table if not exists private.crew_password_copies (
 user_id uuid primary key references auth.users(id) on delete cascade,
 ciphertext text not null,
 password_fingerprint text not null,
 saved_at timestamptz not null default now()
);
alter table private.crew_password_copies enable row level security;
revoke all on private.crew_password_copies from public, anon, authenticated, service_role;

create or replace function private.invalidate_crew_password_copy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.encrypted_password is distinct from new.encrypted_password then
  delete from private.crew_password_copies where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.invalidate_crew_password_copy() from public,anon,authenticated;
drop trigger if exists invalidate_crew_password_copy on auth.users;
create trigger invalidate_crew_password_copy after update of encrypted_password on auth.users
 for each row execute function private.invalidate_crew_password_copy();

create or replace function private.save_crew_password_copy(p_actor uuid,p_user uuid,p_expected_updated_at timestamptz,p_ciphertext text)
returns void language plpgsql security definer set search_path = '' as $$
declare version timestamptz; fingerprint text;
begin
 perform pg_advisory_xact_lock(184621,1);
 if (auth.uid() is not null and auth.uid()<>p_actor) or not public.is_admin(p_actor) then
  raise exception 'Akses admin diperlukan.' using errcode='42501';
 end if;
 if not exists(select 1 from public.crew where user_id=p_user and deleted_at is null)
 or exists(select 1 from public.crew_deletion_requests where user_id=p_user)
 or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user and
  (r.code='SUPER_ADMIN' or (r.code not in ('CREW_STORE','CREW_EVENT') and not exists(select 1 from public.user_roles ar join public.roles r2 on r2.id=ar.role_id where ar.user_id=p_actor and r2.code='SUPER_ADMIN')))) then
  raise exception 'Akun ini tidak mendukung salinan password.' using errcode='42501';
 end if;
 select updated_at,md5(encrypted_password) into version,fingerprint from auth.users where id=p_user for update;
 if not found or p_expected_updated_at is null or version is distinct from p_expected_updated_at or fingerprint is null then
  raise exception 'Password telah berubah. Salinan tidak disimpan.' using errcode='40001';
 end if;
 if p_ciphertext is null or length(p_ciphertext)>2048 or p_ciphertext !~ '^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$' then raise exception 'Salinan tidak valid.';end if;
 insert into private.crew_password_copies(user_id,ciphertext,password_fingerprint) values(p_user,p_ciphertext,fingerprint)
 on conflict(user_id) do update set ciphertext=excluded.ciphertext,password_fingerprint=excluded.password_fingerprint,saved_at=now();
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(p_actor,'CREW_PASSWORD_COPY_SAVED','users',p_user);
end $$;

create or replace function private.read_crew_password_copy(p_actor uuid,p_crew uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target uuid; result jsonb;
begin
 perform pg_advisory_xact_lock(184621,1);
 if (auth.uid() is not null and auth.uid()<>p_actor) or not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then
  raise exception 'Hanya Super Admin.' using errcode='42501';
 end if;
 select user_id into target from public.crew where id=p_crew and deleted_at is null;
 if target is null or exists(select 1 from public.crew_deletion_requests where user_id=target)
 or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=target and r.code='SUPER_ADMIN') then
  raise exception 'Akun ini tidak dapat dibuka.' using errcode='42501';
 end if;
 select jsonb_build_object('user_id',v.user_id,'ciphertext',v.ciphertext) into result
 from private.crew_password_copies v join auth.users u on u.id=v.user_id
 where v.user_id=target and v.password_fingerprint=md5(u.encrypted_password);
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
 values(p_actor,'CREW_PASSWORD_REVEAL_REQUEST','crew',p_crew,jsonb_build_object('available',result is not null));
 return result;
end $$;
revoke all on function private.save_crew_password_copy(uuid,uuid,timestamptz,text), private.read_crew_password_copy(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.save_crew_password_copy(uuid,uuid,timestamptz,text), private.read_crew_password_copy(uuid,uuid) to service_role;
-- Public RPC wrappers do not have owner privileges. Only the backend service role can call them.
create or replace function public.save_crew_password_copy(p_actor uuid,p_user uuid,p_expected_updated_at timestamptz,p_ciphertext text)
returns void language sql security invoker set search_path='' as $$ select private.save_crew_password_copy(p_actor,p_user,p_expected_updated_at,p_ciphertext) $$;
create or replace function public.read_crew_password_copy(p_actor uuid,p_crew uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.read_crew_password_copy(p_actor,p_crew) $$;
revoke all on function public.save_crew_password_copy(uuid,uuid,timestamptz,text),public.read_crew_password_copy(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_crew_password_copy(uuid,uuid,timestamptz,text),public.read_crew_password_copy(uuid,uuid) to service_role;

-- Super Admin may edit promoted staff without overwriting their account role or city.
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
    jsonb_build_object('employee_code',c.employee_code,'branch_id',c.branch_id,'company_name',c.company_name,'job_title',c.job_title,'operation',p_operation,'assignTo',p_data->>'assignTo'));
  return c.id;
end;
$$;
revoke all on function public.manage_crew(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.manage_crew(uuid,text,uuid,uuid,jsonb) to service_role;


notify pgrst, 'reload schema';
commit;
