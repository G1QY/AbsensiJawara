begin;
-- Division is a profile title. Access is determined exclusively by account role.
alter table public.roles drop constraint if exists roles_code_check;
alter table public.roles add constraint roles_code_check check(code in ('SUPER_ADMIN','HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF'));
insert into public.roles(code,name,description) values
 ('HEAD_OFFICE','Head Office','Dashboard kerja dan absensi pribadi kantor'),
 ('OFFICE_STAFF','Staff Kantor','Dashboard kerja dan absensi pribadi kantor'),
 ('PRODUCTION_STAFF','Staff Produksi','Dashboard kerja dan absensi pribadi produksi')
on conflict(code) do update set name=excluded.name,description=excluded.description;
alter table public.crew add column if not exists division text not null default '';
alter table public.crew drop constraint if exists crew_division_check;
alter table public.crew add constraint crew_division_check check(division in ('','Operational','Finance','Business Development','Marketing','Produksi','Teknisi','Packing'));
comment on column public.crew.division is 'Display title only; never grants permissions.';

-- New employee roles have the same server boundary as the city-scoped role.
-- The existing restrictive policies call this helper, so no policies are removed.
create or replace function private.account_requires_server() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is null
 or not exists(select 1 from public.users where id=(select auth.uid()) and is_active)
 or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=(select auth.uid()) and r.code in ('HEAD_STORE','ADMIN_STORE','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF'));
$$;
revoke all on function private.account_requires_server() from public,anon;
grant execute on function private.account_requires_server() to authenticated,service_role;

-- Existing managers also need a work profile to receive a workplace and schedule.
insert into public.crew(user_id,employee_code,crew_type,join_date,status)
select u.id,'STAFF-'||upper(left(md5(u.id::text),24)),'CREW_STORE',(now() at time zone 'Asia/Jakarta')::date,'ACTIVE'
from public.users u where u.is_active and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=u.id and r.code in ('HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF'))
and not exists(select 1 from public.crew c where c.user_id=u.id);
-- Preserve assignment/history rows; only the old event assignment is ended.
update public.event_assignments ea set status='ENDED' from public.crew c
where ea.crew_id=c.id and ea.status='ACTIVE' and c.crew_type='CREW_EVENT' and exists(
 select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=c.user_id and r.code in ('HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF'));
update public.crew c set crew_type='CREW_STORE',updated_at=now()
where c.crew_type='CREW_EVENT' and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=c.user_id and r.code in ('HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF'));

drop function if exists public.set_account_role(uuid,uuid,text,uuid);
create or replace function public.set_account_role(p_actor uuid,p_user uuid,p_role text,p_scope_branch uuid default null,p_division text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.crew%rowtype; city text; target_role uuid; previous jsonb; work_type text; division_title text := coalesce(trim(p_division),'');
begin
 perform pg_advisory_xact_lock(184621,1);
 if not exists(select 1 from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.id=p_actor and u.is_active and r.code='SUPER_ADMIN') then raise exception 'Hanya Super Admin dapat mengubah role.' using errcode='42501'; end if;
 if p_user=p_actor then raise exception 'Role akun sendiri tidak dapat diubah.' using errcode='42501'; end if;
 if p_role is null or p_role not in ('SUPER_ADMIN','HEAD_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF') then raise exception 'Role tidak valid.'; end if;
 if (p_role in ('HEAD_OFFICE','OFFICE_STAFF') and division_title not in ('Operational','Finance','Business Development','Marketing','Produksi','Teknisi'))
 or (p_role='PRODUCTION_STAFF' and division_title not in ('Packing','Produksi')) then raise exception 'Pilih divisi yang sesuai dengan role.'; end if;
 if p_role not in ('HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF') then division_title := ''; end if;
 select * into c from public.crew where user_id=p_user for update;
 perform 1 from public.users where id=p_user and is_active for update;
 if not found or c.deleted_at is not null or exists(select 1 from public.crew_deletion_requests where user_id=p_user) then raise exception 'Akun harus aktif dan tidak sedang dihapus.'; end if;
 if p_role='HEAD_STORE' then
  select trim(city_name) into city from public.branches where id=p_scope_branch;
  if city is null or city='' then raise exception 'Pilih kota cakupan Head Store.'; end if;
 end if;
 work_type := case when p_role='CREW_EVENT' then 'CREW_EVENT' else 'CREW_STORE' end;
 if p_role<>'SUPER_ADMIN' and c.id is null then
  insert into public.crew(user_id,employee_code,crew_type,join_date,status)
  values(p_user,'STAFF-'||upper(left(md5(p_user::text),24)),work_type,(now() at time zone 'Asia/Jakarta')::date,'ACTIVE') returning * into c;
 end if;
 select jsonb_agg(r.code) into previous from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user;
 select id into target_role from public.roles where code=p_role;
 if target_role is null then raise exception 'Role belum tersedia.'; end if;
 delete from public.user_roles where user_id=p_user;
 insert into public.user_roles(user_id,role_id) values(p_user,target_role);
 delete from public.head_store_scopes where user_id=p_user;
 if p_role='HEAD_STORE' then insert into public.head_store_scopes(user_id,city_name) values(p_user,city); end if;
 if p_role<>'SUPER_ADMIN' and c.crew_type<>work_type then
  update public.store_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  update public.event_assignments set status='ENDED' where crew_id=c.id and status='ACTIVE';
  update public.crew set crew_type=work_type,updated_at=now() where id=c.id;
 end if;
 update public.crew set division=division_title,updated_at=now() where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
 values(p_actor,'ACCOUNT_ROLE_CHANGED','users',p_user,jsonb_build_object('roles',previous,'division',c.division),jsonb_build_object('role',p_role,'city',city,'division',division_title));
 return jsonb_build_object('role',p_role,'city',city,'division',division_title,'message','Role tersimpan. Pengguna perlu masuk kembali untuk memperbarui menu.');
end $$;
revoke all on function public.set_account_role(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.set_account_role(uuid,uuid,text,uuid,text) to service_role;

-- Every submitted attendance needs review. A later clock-out is new evidence.
alter table public.attendance_logs alter column review_status set default 'PENDING';
update public.attendance_logs set review_status='PENDING',reviewed_by=null,reviewed_at=null,review_note=''
 where check_in is not null and review_status='NOT_REQUIRED';
create or replace function private.require_attendance_review() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.review_status := 'PENDING'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := '';
 elsif row(new.check_in,new.check_out,new.check_in_photo_url,new.check_out_photo_url,new.check_in_lat,new.check_in_lng,new.check_out_lat,new.check_out_lng,new.store_schedule_id,new.event_schedule_id,new.check_in_note,new.check_out_note)
 is distinct from row(old.check_in,old.check_out,old.check_in_photo_url,old.check_out_photo_url,old.check_in_lat,old.check_in_lng,old.check_out_lat,old.check_out_lng,old.store_schedule_id,old.event_schedule_id,old.check_in_note,old.check_out_note) then
  new.review_status := 'PENDING'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := '';
 end if;
 return new;
end $$;
revoke all on function private.require_attendance_review() from public,anon,authenticated;
drop trigger if exists attendance_requires_review on public.attendance_logs;
create trigger attendance_requires_review before insert or update on public.attendance_logs
 for each row execute function private.require_attendance_review();
-- Clients must use the GPS/photo-validated server API; a self-owned row is not
-- permission to alter review_status, overtime approval, or its timestamps.
revoke insert,update,delete on public.attendance_logs from anon,authenticated;

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
    if exists(select 1 from public.crew where id=attendance_row.crew_id and user_id=p_actor) then
      raise exception 'Absensi sendiri harus ditinjau admin lain.' using errcode='42501';
    end if;
    previous := case when p_target='overtime' then attendance_row.overtime_status else attendance_row.review_status end;
  end if;
  if previous is null then raise exception 'Absensi tidak ditemukan.' using errcode='P0002'; end if;
  if previous=p_decision then return; end if;
  if previous<>'PENDING' and not (p_kind='registered' and p_target='attendance' and previous='NOT_REQUIRED') then raise exception 'Data sudah ditinjau atau tidak membutuhkan tinjauan. Muat ulang.' using errcode='40001'; end if;

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
