begin;
-- CLI unavailable in the build environment. Generated with current UTC timestamp.
create or replace function public.move_unused_store_schedules(p_assignment uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare target public.store_assignments%rowtype; previous_id uuid; effective_date date; moved integer:=0;
begin
 select * into target from public.store_assignments where id=p_assignment;
 if not found or target.status<>'ACTIVE' then return 0; end if;
 perform id from public.crew where id=target.crew_id for update;
 effective_date:=greatest(target.start_date,(now() at time zone 'Asia/Jakarta')::date);
 select a.id into previous_id from public.store_assignments a
 where a.crew_id=target.crew_id and a.id<>target.id and a.status='ENDED'
 and a.start_date<=target.start_date and a.created_at<=target.created_at
 order by a.start_date desc,a.created_at desc,a.id limit 1;
 if previous_id is null then return 0; end if;
 -- Never reassign a schedule referenced by attendance, including an open clock-in.
 update public.store_schedules s set store_assignment_id=target.id
 where s.store_assignment_id=previous_id and s.schedule_date>=effective_date
 and (target.end_date is null or s.schedule_date<=target.end_date)
 and not exists(select 1 from public.attendance_logs l where l.store_schedule_id=s.id)
 and not exists(select 1 from public.store_schedules other where other.store_assignment_id=target.id and other.schedule_date=s.schedule_date);
 get diagnostics moved=row_count;
 return moved;
end $$;
revoke all on function public.move_unused_store_schedules(uuid) from public,anon,authenticated;
grant execute on function public.move_unused_store_schedules(uuid) to service_role;
create or replace function public.sync_store_transfer_schedules() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform public.move_unused_store_schedules(new.id);
 return new;
end $$;
revoke all on function public.sync_store_transfer_schedules() from public,anon,authenticated;
grant execute on function public.sync_store_transfer_schedules() to service_role;
create trigger store_transfer_schedule_sync after insert on public.store_assignments
for each row execute function public.sync_store_transfer_schedules();

create or replace function public.sync_event_assignment_schedule() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype;
begin
 if new.status<>'ACTIVE' then return new; end if;
 select * into e from public.events where id=new.event_id;
 if e.start_time is null or e.end_time is null or not exists(select 1 from public.event_locations where event_id=e.id) then
 raise exception 'Lengkapi jam dan lokasi event sebelum menugaskan crew.'; end if;
 perform id from public.crew where id=new.crew_id for update;
 if exists(select 1 from public.event_assignments ea join public.event_schedules es on es.event_assignment_id=ea.id join public.events other on other.id=ea.event_id where ea.crew_id=new.crew_id and ea.event_id<>new.event_id and ea.status='ACTIVE' and es.status='ACTIVE' and other.status in ('SCHEDULED','ONGOING') and es.schedule_date=e.event_date) then raise exception 'Crew sudah memiliki jadwal event lain pada tanggal ini.'; end if;
 if exists(select 1 from public.attendance_logs where event_assignment_id=new.id) then return new; end if;
 update public.event_schedules set schedule_date=e.event_date,start_time=e.start_time,end_time=e.end_time,status='ACTIVE',overtime_preapproved=e.overtime_preapproved where event_assignment_id=new.id;
 if not found then
 insert into public.event_schedules(event_assignment_id,schedule_date,start_time,end_time,overtime_preapproved) values(new.id,e.event_date,e.start_time,e.end_time,e.overtime_preapproved);
 end if;
 return new;
end $$;
-- Repair unused future schedules left behind by earlier store transfers.
do $$ declare a record; begin
 for a in select id from public.store_assignments where status='ACTIVE' loop
 perform public.move_unused_store_schedules(a.id);
 end loop;
end $$;
-- Restore missing event schedules only where complete event metadata is available.
update public.event_assignments a set status=a.status from public.events e
where a.event_id=e.id and a.status='ACTIVE' and e.status in ('SCHEDULED','ONGOING')
and e.event_date>=(now() at time zone 'Asia/Jakarta')::date
and e.start_time is not null and e.end_time is not null
and exists(select 1 from public.event_locations where event_id=e.id)
and not exists(select 1 from public.event_schedules where event_assignment_id=a.id);
notify pgrst,'reload schema';
commit;
