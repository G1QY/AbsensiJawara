begin;
-- Kota is a separate attribute of a physical branch (e.g. Jakarta / Blok M).
alter table public.branches add column if not exists city_name text not null default '';
alter table public.branches drop constraint if exists branches_city_name_length;
alter table public.branches add constraint branches_city_name_length check(length(city_name)<=150);
-- Preserve identifiers and existing branch names. Admin can correct the physical branch later.
update public.branches set city_name=name where city_name='' and lower(name) in ('jakarta','bandung','jogja','yogyakarta','tasikmalaya');
alter table public.stores add column if not exists deleted_at timestamptz;
create index if not exists stores_current_branch_idx on public.stores(branch_id) where deleted_at is null;


-- Never cascade master-location deletion into attendance history.
do $$ declare fk record; begin
 for fk in select c.conname,c.conrelid::regclass as child_table,pg_get_constraintdef(c.oid) as definition
   from pg_constraint c where c.contype='f' and c.confdeltype='c'
   and c.confrelid in ('public.stores'::regclass,'public.branches'::regclass)
 loop
  execute format('alter table %s drop constraint %I',fk.child_table,fk.conname);
  execute format('alter table %s add constraint %I %s',fk.child_table,fk.conname,replace(fk.definition,'ON DELETE CASCADE','ON DELETE RESTRICT'));
 end loop;
end $$;
alter table public.stores drop constraint if exists archived_store_inactive;
alter table public.stores add constraint archived_store_inactive check(deleted_at is null or status='INACTIVE');

create or replace function public.remove_directory_location(p_actor uuid,p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.stores%rowtype; linked boolean; duties boolean := false; active_count integer;
begin
 if not coalesce(public.is_admin(p_actor),false) or not exists(select 1 from public.users where id=p_actor and is_active) then
  raise exception 'Hanya admin aktif yang dapat menghapus lokasi.' using errcode='42501'; end if;
 select * into previous from public.stores where id=p_id for update;
 if not found then raise exception 'Lokasi tidak ditemukan.' using errcode='P0002'; end if;
 if previous.deleted_at is not null then return jsonb_build_object('id',p_id,'archived',true,'message','Lokasi sudah diarsipkan.'); end if;
 select count(*) into active_count from public.store_assignments where store_id=p_id and status='ACTIVE' and (end_date is null or end_date >= (now() at time zone 'Asia/Jakarta')::date);
 if active_count>0 then raise exception 'Lokasi masih memiliki % penugasan aktif. Akhiri penugasan melalui detail crew terlebih dahulu.',active_count using errcode='23503'; end if;
 select exists(select 1 from public.store_assignments where store_id=p_id)
    or exists(select 1 from public.guest_attendances where store_id=p_id) into linked;
 if to_regclass('public.attendance_duties') is not null then
  execute 'select exists(select 1 from public.attendance_duties where store_id=$1)' into duties using p_id;
 end if;
 linked:=linked or duties;
 if not linked then
  begin
   delete from public.stores where id=p_id;
  exception when foreign_key_violation then linked:=true;
  end;
 end if;
 if linked then update public.stores set status='INACTIVE',deleted_at=now() where id=p_id; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
 values(p_actor,case when linked then 'DIRECTORY_ARCHIVED' else 'DIRECTORY_DELETED' end,'stores',p_id,to_jsonb(previous),jsonb_build_object('name',previous.name));
 return jsonb_build_object('id',p_id,'archived',linked,'message',case when linked then 'Lokasi diarsipkan. Riwayat dan jadwal lama tetap tersimpan.' else 'Lokasi dihapus.' end);
end $$;
revoke all on function public.remove_directory_location(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_directory_location(uuid,uuid) to service_role;

-- Lock parent rows before new references so archive cannot race a new assignment/submission.
create or replace function public.guard_current_store() returns trigger language plpgsql security invoker set search_path='' as $$
declare location public.stores%rowtype;
begin
 if new.store_id is null then return new; end if;
 if tg_op='UPDATE' then
  if new.store_id is not distinct from old.store_id then
   if tg_table_name<>'store_assignments' then return new; end if;
   if to_jsonb(new)->>'status' is not distinct from to_jsonb(old)->>'status' or to_jsonb(new)->>'status'<>'ACTIVE' then return new; end if;
  end if;
 end if;
 select * into location from public.stores where id=new.store_id for update;
 if not found or location.deleted_at is not null or location.status<>'ACTIVE' then
  raise exception 'Lokasi tidak aktif atau sudah diarsipkan. Pilih lokasi aktif.' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists guard_current_store on public.store_assignments;
create trigger guard_current_store before insert or update on public.store_assignments for each row execute function public.guard_current_store();
drop trigger if exists guard_current_store on public.guest_attendances;
create trigger guard_current_store before insert or update on public.guest_attendances for each row execute function public.guard_current_store();
do $$ begin
 if to_regclass('public.attendance_duties') is not null then
  execute 'drop trigger if exists guard_current_store on public.attendance_duties';
  execute 'create trigger guard_current_store before insert or update on public.attendance_duties for each row execute function public.guard_current_store()';
 end if;
end $$;

create or replace function public.delete_admin_attendance(p_actor uuid,p_kind text,p_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; affected_name text;
begin
 if not coalesce(public.is_admin(p_actor),false) or not exists(select 1 from public.users where id=p_actor and is_active) then
  raise exception 'Hanya admin aktif yang dapat menghapus absensi.' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('guest','registered') or length(trim(coalesce(p_reason,'')))=0 or length(p_reason)>1000 then raise exception 'Isi alasan penghapusan yang valid.'; end if;
 if p_kind='guest' then
  select to_jsonb(g),g.full_name into snapshot,affected_name from public.guest_attendances g where id=p_id for update;
 else
  select to_jsonb(a) into snapshot from public.attendance_logs a where id=p_id for update;
  select u.full_name into affected_name from public.crew c join public.users u on u.id=c.user_id where c.id=(snapshot->>'crew_id')::uuid;
 end if;
 if snapshot is null then raise exception 'Absensi tidak ditemukan atau sudah dihapus.' using errcode='P0002'; end if;
 if p_kind='registered' then
  snapshot:=snapshot || jsonb_build_object('overtimes',(select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from public.overtimes o where attendance_id=p_id),'corrections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.attendance_corrections c where attendance_id=p_id));
  delete from public.overtimes where attendance_id=p_id;
  delete from public.attendance_corrections where attendance_id=p_id;
  delete from public.attendance_logs where id=p_id;
 else
  delete from public.guest_attendances where id=p_id;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
 values(p_actor,'ATTENDANCE_DELETED',case when p_kind='guest' then 'guest_attendances' else 'attendance_logs' end,p_id,snapshot || jsonb_build_object('full_name',affected_name),jsonb_build_object('full_name',affected_name,'reason',trim(p_reason)));
end $$;
revoke all on function public.delete_admin_attendance(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.delete_admin_attendance(uuid,text,uuid,text) to service_role;

-- Serialize updates at PostgreSQL level. No client may reopen a completed workflow.
create or replace function public.lock_completed_event_workflow() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.max_reached>=15 and (new.data is distinct from old.data or new.max_reached is distinct from old.max_reached or new.current_step is distinct from old.current_step) then
  raise exception 'Workflow sudah selesai. Data hanya dapat ditinjau.' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists lock_completed_event_workflow on public.event_workflows;
create trigger lock_completed_event_workflow before update on public.event_workflows for each row execute function public.lock_completed_event_workflow();

create or replace function public.audit_event_workflow_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.data is not distinct from old.data and new.max_reached is not distinct from old.max_reached then return new; end if;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
 values(new.updated_by,case when new.max_reached>=15 then 'WORKFLOW_COMPLETED' else 'WORKFLOW_SAVED' end,'events',new.event_id,jsonb_build_object('step',new.current_step,'max_reached',new.max_reached,'actor_name',(select full_name from public.users where id=new.updated_by)));
 if new.max_reached>=15 then
  update public.events set status='COMPLETED' where id=new.event_id and status<>'CANCELLED';
  update public.event_assignments set status='ENDED' where event_id=new.event_id and status='ACTIVE';
 end if;
 return new;
end $$;
drop trigger if exists audit_event_workflow_change on public.event_workflows;
create trigger audit_event_workflow_change after insert or update on public.event_workflows for each row execute function public.audit_event_workflow_change();
notify pgrst, 'reload schema';
commit;
