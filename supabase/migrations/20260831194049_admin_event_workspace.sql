begin;
alter table public.events add column start_time time, add column end_time time,
  add column pic_crew_id uuid references public.crew(id), add column updated_at timestamptz not null default now();
create index events_pic_idx on public.events(pic_crew_id);
create index if not exists event_locations_event_idx on public.event_locations(event_id);
alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check check(status in ('DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED'));

-- Service-only transaction: event, GPS location and existing crew schedules remain consistent.
create function public.save_admin_event(p_actor uuid,p_id uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype; location_id uuid; result uuid; s time; t time; d date; b uuid; pic uuid; locked boolean;
begin
  if not public.is_admin(p_actor) or not exists(select 1 from public.users where id=p_actor and is_active) then raise exception 'Admin aktif diperlukan.' using errcode='42501'; end if;
  s:=(p_data->>'start_time')::time; t:=(p_data->>'end_time')::time; d:=(p_data->>'event_date')::date; b:=(p_data->>'branch_id')::uuid; pic:=nullif(p_data->>'pic_crew_id','')::uuid;
  if s is null or t is null or s>=t or d is null or b is null then raise exception 'Tanggal, cabang dan jam event wajib diisi. Jam selesai harus setelah jam mulai pada tanggal yang sama.'; end if;
  if coalesce(length(trim(p_data->>'event_name')),0)=0 or coalesce(length(trim(p_data->>'event_code')),0)=0 or coalesce(length(trim(p_data->>'address')),0)=0 then raise exception 'Nama, kode dan alamat wajib diisi.'; end if;
  if (p_data->>'latitude') is null or (p_data->>'longitude') is null or abs((p_data->>'latitude')::numeric)>90 or abs((p_data->>'longitude')::numeric)>180 or coalesce((p_data->>'radius_meters')::int,0) not between 1 and 10000 then raise exception 'Koordinat atau radius tidak valid.'; end if;
  if pic is not null and not exists(select 1 from public.crew c join public.users u on u.id=c.user_id where c.id=pic and c.status='ACTIVE' and u.is_active and c.deleted_at is null and c.crew_type='CREW_EVENT' and c.branch_id=b) then raise exception 'PIC harus crew event aktif pada cabang yang sama.'; end if;
  if p_id is not null then
    select * into e from public.events where id=p_id for update;
    if not found then raise exception 'Event tidak ditemukan.' using errcode='P0002'; end if;
    if (p_data->>'expected_updated_at') is null or e.updated_at<>(p_data->>'expected_updated_at')::timestamptz then raise exception 'Event sudah berubah. Muat ulang sebelum mengedit.' using errcode='40001'; end if;
    if e.branch_id is not null and e.branch_id<>b then raise exception 'Cabang event tidak dapat dipindah. Buat event baru.'; end if;
    perform c.id from public.crew c join public.event_assignments ea on ea.crew_id=c.id where ea.event_id=p_id and ea.status='ACTIVE' order by c.id for update of c;
    if exists(select 1 from public.event_assignments own join public.event_assignments other on other.crew_id=own.crew_id join public.event_schedules es on es.event_assignment_id=other.id join public.events other_event on other_event.id=other.event_id where own.event_id=p_id and own.status='ACTIVE' and other.event_id<>p_id and other.status='ACTIVE' and es.status='ACTIVE' and other_event.status in ('SCHEDULED','ONGOING') and es.schedule_date=d) then raise exception 'Crew sudah memiliki jadwal event lain pada tanggal ini.'; end if;
    select exists(select 1 from public.attendance_logs a join public.event_assignments ea on ea.id=a.event_assignment_id where ea.event_id=p_id) into locked;
    select id into location_id from public.event_locations where event_id=p_id order by id limit 1;
    if (select count(*) from public.event_locations where event_id=p_id)>1 then raise exception 'Event memiliki beberapa lokasi. Rapikan lokasi melalui admin database sebelum mengedit.'; end if;
    if locked and (e.event_date<>d or e.start_time is distinct from s or e.end_time is distinct from t or exists(select 1 from public.event_locations where id=location_id and (address is distinct from p_data->>'address' or latitude<>(p_data->>'latitude')::numeric or longitude<>(p_data->>'longitude')::numeric or radius_meters<>(p_data->>'radius_meters')::int))) then raise exception 'Jadwal/lokasi sudah dipakai absensi dan tidak boleh diubah.'; end if;
    update public.events set event_code=trim(p_data->>'event_code'),event_name=trim(p_data->>'event_name'),client_name=coalesce(p_data->>'client_name',''),branch_id=b,event_date=d,start_time=s,end_time=t,pic_crew_id=pic,status=p_data->>'status',updated_at=clock_timestamp() where id=p_id;
    result:=p_id;
  else
    insert into public.events(event_code,event_name,client_name,branch_id,event_date,start_time,end_time,pic_crew_id,status) values(trim(p_data->>'event_code'),trim(p_data->>'event_name'),coalesce(p_data->>'client_name',''),b,d,s,t,pic,p_data->>'status') returning id into result;
  end if;
  if location_id is null then
    insert into public.event_locations(event_id,address,latitude,longitude,radius_meters) values(result,p_data->>'address',(p_data->>'latitude')::numeric,(p_data->>'longitude')::numeric,(p_data->>'radius_meters')::int);
  else
    update public.event_locations set address=p_data->>'address',latitude=(p_data->>'latitude')::numeric,longitude=(p_data->>'longitude')::numeric,radius_meters=(p_data->>'radius_meters')::int where id=location_id;
  end if;
  if not coalesce(locked,false) then
    update public.event_schedules es set schedule_date=d,start_time=s,end_time=t from public.event_assignments ea where ea.id=es.event_assignment_id and ea.event_id=result and ea.status='ACTIVE';
  end if;
  insert into public.event_schedules(event_assignment_id,schedule_date,start_time,end_time)
    select ea.id,d,s,t from public.event_assignments ea where ea.event_id=result and ea.status='ACTIVE' and not exists(select 1 from public.event_schedules es where es.event_assignment_id=ea.id);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor,'EVENT_SAVED','events',result,jsonb_build_object('name',p_data->>'event_name','date',d));
  return result;
end $$;

create function public.assign_admin_event(p_actor uuid,p_event uuid,p_crew uuid,p_position text,p_status text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype; c public.crew%rowtype; result uuid;
begin
  if not public.is_admin(p_actor) or not exists(select 1 from public.users where id=p_actor and is_active) then raise exception 'Admin aktif diperlukan.' using errcode='42501'; end if;
  select * into e from public.events where id=p_event for update;
  if not found then raise exception 'Event tidak ditemukan.' using errcode='P0002'; end if;
  if p_status not in ('ACTIVE','ENDED') or p_status is null or length(coalesce(p_position,''))>50 then raise exception 'Penugasan tidak valid.'; end if;
  select * into c from public.crew where id=p_crew for update;
  if not found then raise exception 'Crew tidak ditemukan.'; end if;
  if p_status='ACTIVE' and (c.crew_type<>'CREW_EVENT' or c.status<>'ACTIVE' or c.deleted_at is not null or c.branch_id is distinct from e.branch_id or not exists(select 1 from public.users where id=c.user_id and is_active)) then raise exception 'Pilih crew event aktif pada cabang yang sama.'; end if;
  if p_status='ACTIVE' and (e.status not in ('SCHEDULED','ONGOING') or e.start_time is null or e.end_time is null or not exists(select 1 from public.event_locations where event_id=p_event)) then raise exception 'Lengkapi lokasi/jam dan aktifkan event sebelum menugaskan crew.'; end if;
  if p_status='ACTIVE' and exists(select 1 from public.event_assignments ea join public.event_schedules es on es.event_assignment_id=ea.id join public.events other on other.id=ea.event_id where ea.crew_id=p_crew and ea.event_id<>p_event and ea.status='ACTIVE' and es.status='ACTIVE' and other.status in ('SCHEDULED','ONGOING') and es.schedule_date=e.event_date) then raise exception 'Crew sudah memiliki jadwal event lain pada tanggal ini. Akhiri penugasan tersebut terlebih dahulu.'; end if;
  select id into result from public.event_assignments where event_id=p_event and crew_id=p_crew and status='ACTIVE' order by id limit 1;
  if result is null and p_status='ACTIVE' then
    insert into public.event_assignments(event_id,crew_id,position,status) values(p_event,p_crew,coalesce(p_position,''),p_status) returning id into result;
  elsif result is not null then update public.event_assignments set position=coalesce(p_position,''),status=p_status where id=result;
  else raise exception 'Penugasan aktif tidak ditemukan.'; end if;
  if p_status='ACTIVE' and not exists(select 1 from public.event_schedules where event_assignment_id=result) then
    insert into public.event_schedules(event_assignment_id,schedule_date,start_time,end_time) values(result,e.event_date,e.start_time,e.end_time);
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor,'EVENT_CREW_'||p_status,'events',p_event,jsonb_build_object('crew_id',p_crew,'assignment_id',result));
  return result;
end $$;
revoke all on function public.save_admin_event(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.assign_admin_event(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_admin_event(uuid,uuid,jsonb) to service_role;
grant execute on function public.assign_admin_event(uuid,uuid,uuid,text,text) to service_role;

-- Also covers assignments created through Kelola Crew's existing transaction.
create function public.sync_event_assignment_schedule() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype;
begin
  if new.status<>'ACTIVE' then return new; end if;
  select * into e from public.events where id=new.event_id;
  if e.start_time is null or e.end_time is null or not exists(select 1 from public.event_locations where event_id=e.id) then return new; end if;
  perform id from public.crew where id=new.crew_id for update;
  if exists(select 1 from public.event_assignments ea join public.event_schedules es on es.event_assignment_id=ea.id join public.events other on other.id=ea.event_id where ea.crew_id=new.crew_id and ea.event_id<>new.event_id and ea.status='ACTIVE' and es.status='ACTIVE' and other.status in ('SCHEDULED','ONGOING') and es.schedule_date=e.event_date) then raise exception 'Crew sudah memiliki jadwal event lain pada tanggal ini.'; end if;
  if not exists(select 1 from public.event_schedules where event_assignment_id=new.id) then
    insert into public.event_schedules(event_assignment_id,schedule_date,start_time,end_time) values(new.id,e.event_date,e.start_time,e.end_time);
  end if;
  return new;
end $$;
revoke all on function public.sync_event_assignment_schedule() from public,anon,authenticated;
grant execute on function public.sync_event_assignment_schedule() to service_role;
create trigger event_assignment_schedule_sync after insert or update of status,event_id,crew_id on public.event_assignments for each row execute function public.sync_event_assignment_schedule();
notify pgrst,'reload schema';
commit;
