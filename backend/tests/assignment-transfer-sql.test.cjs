const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('store transfer preserves historical and open attendance; event reassignment restores schedules',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
 try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
 const root=path.resolve(__dirname,'../../supabase/migrations');
 for(const name of ['001_foundation.sql','002_workforce.sql','003_attendance.sql'])await db.exec(fs.readFileSync(path.join(root,name),'utf8').replace('create extension if not exists "pgcrypto";',''));
 await db.exec(`create table public.audit_logs(id uuid default gen_random_uuid(),actor_user_id uuid,action text,entity_type text,entity_id uuid,old_data jsonb,new_data jsonb,created_at timestamptz default now());`);
 for(const name of ['20260831110840_admin_branches_crew.sql','20260831194049_admin_event_workspace.sql'])await db.exec(fs.readFileSync(path.join(root,name),'utf8'));
 await db.exec(`alter table events add column overtime_preapproved boolean default false;alter table store_schedules add column overtime_preapproved boolean default false;alter table event_schedules add column overtime_preapproved boolean default false;create unique index uq_schedule on store_schedules(store_assignment_id,schedule_date);`);
 await db.exec(fs.readFileSync(path.join(root,'20260907140529_assignment_attendance_transfer.sql'),'utf8'));
 const user='00000000-0000-4000-8000-000000000001';await db.exec(`insert into auth.users(id,email) values('${user}','transfer@test.local');`);
 const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 const crew=(await one(`insert into crew(user_id,employee_code,crew_type,join_date) values($1,'TRANSFER','CREW_STORE',current_date-1) returning id`,[user])).id;
 const a=(await one(`insert into stores(code,name,latitude,longitude) values('A','Gacoan',-6.9,107.6) returning id`)).id;
 const b=(await one(`insert into stores(code,name,latitude,longitude) values('B','Sukor',-6.8,107.5) returning id`)).id;
 const old=(await one(`insert into store_assignments(crew_id,store_id,start_date) values($1,$2,(now() at time zone 'Asia/Jakarta')::date-1) returning id`,[crew,a])).id;
 await db.query(`insert into store_schedules(store_assignment_id,schedule_date,start_time,end_time) select $1,(now() at time zone 'Asia/Jakarta')::date+i,'09:00','18:00' from generate_series(-1,1) i`,[old]);
 const historical=await one(`select * from store_schedules where store_assignment_id=$1 order by schedule_date limit 1`,[old]);
 await db.query(`insert into attendance_logs(crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,check_out) values($1,$2,$3,$4,now()-interval '1 day',now()-interval '18 hours')`,[crew,old,historical.id,historical.schedule_date]);
 await db.query(`update store_assignments set status='ENDED' where id=$1`,[old]);
 const current=(await one(`insert into store_assignments(crew_id,store_id,start_date) values($1,$2,(now() at time zone 'Asia/Jakarta')::date) returning id`,[crew,b])).id;
 assert.equal((await one(`select count(*)::int n from store_schedules where store_assignment_id=$1`,[current])).n,2);
 assert.equal((await one(`select store_assignment_id from store_schedules where id=$1`,[historical.id])).store_assignment_id,old);
 assert.equal((await one(`select move_unused_store_schedules($1) n`,[current])).n,0);
 const open=await one(`select * from store_schedules where store_assignment_id=$1 order by schedule_date limit 1`,[current]);
 await db.query(`insert into attendance_logs(crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in) values($1,$2,$3,$4,now())`,[crew,current,open.id,open.schedule_date]);
 await db.query(`update store_assignments set status='ENDED' where id=$1`,[current]);
 const third=(await one(`insert into store_assignments(crew_id,store_id,start_date,created_at) values($1,$2,(now() at time zone 'Asia/Jakarta')::date,now()+interval '1 second') returning id`,[crew,a])).id;
 assert.equal((await one(`select store_assignment_id from store_schedules where id=$1`,[open.id])).store_assignment_id,current);
 assert.equal((await one(`select count(*)::int n from store_schedules where store_assignment_id=$1`,[third])).n,1);
 const event=(await one(`insert into events(event_code,event_name,event_date,start_time,end_time) values('EV-TRANSFER','Event Baru',current_date+1,'10:00','17:00') returning id`)).id;
 await db.query(`insert into event_locations(event_id,latitude,longitude) values($1,-6.8,107.5)`,[event]);
 const assignment=(await one(`insert into event_assignments(crew_id,event_id,position) values($1,$2,'Fotobox') returning id`,[crew,event])).id;
 assert.equal((await one(`select start_time from event_schedules where event_assignment_id=$1`,[assignment])).start_time,'10:00:00');
 await db.query(`update event_assignments set status='ENDED' where id=$1`,[assignment]);await db.query(`update event_schedules set status='CANCELLED' where event_assignment_id=$1`,[assignment]);await db.query(`update event_assignments set status='ACTIVE' where id=$1`,[assignment]);
 assert.equal((await one(`select status from event_schedules where event_assignment_id=$1`,[assignment])).status,'ACTIVE');
 }finally{await db.close();}
});
