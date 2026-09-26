begin;
alter table public.store_schedules add column if not exists shift_number smallint not null default 1;
alter table public.store_schedules drop constraint if exists store_schedules_shift_number_check;
alter table public.store_schedules add constraint store_schedules_shift_number_check check(shift_number between 1 and 3);
comment on column public.store_schedules.shift_number is 'Shift label 1/2/3. schedule_date is the start date in WIB; end_time before start_time ends on the next day.';

-- Serialize competing schedule edits for one employee. Compare real intervals,
-- including the preceding/following day, rather than comparing clock strings.
create or replace function private.validate_work_shift() returns trigger
language plpgsql security invoker set search_path='' as $$
declare person uuid; new_start timestamp; new_end timestamp; assignment_active boolean;
begin
 if tg_table_name='store_schedules' then
  select crew_id,status='ACTIVE' and new.schedule_date>=start_date and (end_date is null or new.schedule_date<=end_date)
  into person,assignment_active from public.store_assignments where id=new.store_assignment_id;
  if new.start_time=new.end_time then raise exception 'Jam masuk dan pulang tidak boleh sama.' using errcode='23514'; end if;
 else
  select a.crew_id,a.status='ACTIVE' and e.status in ('SCHEDULED','ONGOING') and new.status='ACTIVE'
  into person,assignment_active from public.event_assignments a join public.events e on e.id=a.event_id where a.id=new.event_assignment_id;
 end if;
 if person is null or not coalesce(assignment_active,false) then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(person::text,2513));
 new_start := new.schedule_date+new.start_time;
 new_end := new.schedule_date+new.end_time+case when new.end_time<=new.start_time then interval '1 day' else interval '0 day' end;
 if exists(select 1 from public.store_schedules s join public.store_assignments a on a.id=s.store_assignment_id
  where a.crew_id=person and not (tg_table_name='store_schedules' and s.id=new.id)
  and s.schedule_date between new.schedule_date-1 and new.schedule_date+1
  and ((a.status='ACTIVE' and s.schedule_date>=a.start_date and (a.end_date is null or s.schedule_date<=a.end_date))
    or exists(select 1 from public.attendance_logs l where l.store_schedule_id=s.id and l.check_in is not null))
  and s.schedule_date+s.start_time<new_end
  and s.schedule_date+s.end_time+case when s.end_time<=s.start_time then interval '1 day' else interval '0 day' end>new_start)
 or exists(select 1 from public.event_schedules s join public.event_assignments a on a.id=s.event_assignment_id join public.events e on e.id=a.event_id
  where a.crew_id=person and not (tg_table_name='event_schedules' and s.id=new.id)
  and s.schedule_date between new.schedule_date-1 and new.schedule_date+1
  and ((s.status='ACTIVE' and a.status='ACTIVE' and e.status in ('SCHEDULED','ONGOING'))
    or exists(select 1 from public.attendance_logs l where l.event_schedule_id=s.id and l.check_in is not null))
  and s.schedule_date+s.start_time<new_end
  and s.schedule_date+s.end_time+case when s.end_time<=s.start_time then interval '1 day' else interval '0 day' end>new_start) then
   raise exception 'Jam shift bertumpuk dengan jadwal lain. Periksa tanggal sebelum dan sesudahnya.' using errcode='23P01';
 end if;
 return new;
end $$;
revoke all on function private.validate_work_shift() from public,anon,authenticated;
drop trigger if exists validate_work_shift on public.store_schedules;
create trigger validate_work_shift before insert or update of store_assignment_id,schedule_date,start_time,end_time on public.store_schedules
 for each row execute function private.validate_work_shift();
drop trigger if exists validate_work_shift on public.event_schedules;
create trigger validate_work_shift before insert or update of event_assignment_id,schedule_date,start_time,end_time,status on public.event_schedules
 for each row execute function private.validate_work_shift();
-- Schedule mutations use the validated server API; browser clients cannot skip it.
revoke insert,update,delete on public.store_schedules,public.event_schedules from anon,authenticated;
notify pgrst,'reload schema';
commit;
