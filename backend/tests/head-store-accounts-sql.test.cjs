const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../supabase/migrations');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('account role, city isolation, RLS and permanent account deletion on local Postgres',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
   create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}');
   create table storage.objects(id uuid default gen_random_uuid(),owner_id text);
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema public,auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`);
  for(const file of ['foundation.sql','workforce.sql','attendance.sql','equipment.sql','audit_rls.sql','attendance_calendar_fields.sql','admin_branches_crew.sql','crew_company_job.sql','attendance_review_guest.sql'])
   await db.exec(fs.readFileSync(path.join(dir,file),'utf8').replace('create extension if not exists "pgcrypto";',''));
  await db.exec(`alter table branches add city_name text not null default '';alter table stores add deleted_at timestamptz,add location_kind text default 'STORE';
   alter table events add pic_crew_id uuid references crew(id);
   create table event_workflows(event_id uuid primary key references events(id),updated_by uuid references users(id));
   create table password_reset_otps(email text,used boolean);
   grant select,insert,update,delete on all tables in schema public to authenticated;
   insert into roles(code,name) values('SUPER_ADMIN','Super Admin'),('ADMIN_STORE','Admin Store'),('EVENT_MANAGER','Event Manager'),('CREW_STORE','Crew Store'),('CREW_EVENT','Crew Event');
   insert into auth.users(id,email) values('${id(1)}','super@test.invalid'),('${id(2)}','head@test.invalid'),('${id(3)}','crew@test.invalid'),('${id(4)}','outside@test.invalid');
   insert into user_roles(user_id,role_id) select '${id(1)}',id from roles where code='SUPER_ADMIN';
   insert into user_roles(user_id,role_id) select '${id(2)}',id from roles where code='ADMIN_STORE';
   insert into user_roles(user_id,role_id) select '${id(3)}',id from roles where code='CREW_STORE';
   insert into user_roles(user_id,role_id) select '${id(4)}',id from roles where code='CREW_STORE';
   update branches set city_name=case when code='BDG' then 'Bandung' else name end;
   insert into branches(id,code,name,city_name) values('${id(10)}','BDG2','Kosambi',' Bandung ');
   insert into crew(id,user_id,employee_code,crew_type,join_date,branch_id) values
    ('${id(20)}','${id(2)}','HEAD','CREW_STORE',current_date,(select id from branches where code='BDG')),
    ('${id(21)}','${id(3)}','CREW','CREW_STORE',current_date,'${id(10)}'),
    ('${id(22)}','${id(4)}','OUTSIDE','CREW_STORE',current_date,(select id from branches where code='JKT'));
   insert into stores(id,code,name,branch_id,latitude,longitude) values
    ('${id(30)}','S1','Bandung One',(select id from branches where code='BDG'),0,0),
    ('${id(31)}','S2','Bandung Two','${id(10)}',0,0),
    ('${id(32)}','S3','Jakarta Store',(select id from branches where code='JKT'),0,0);
   insert into store_assignments(id,crew_id,store_id,start_date) values('${id(40)}','${id(21)}','${id(31)}',current_date),('${id(41)}','${id(22)}','${id(32)}',current_date);
   insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time) values('${id(50)}','${id(40)}',current_date,'09:00','17:00'),('${id(51)}','${id(41)}',current_date,'09:00','17:00');
   insert into attendance_logs(id,crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,status) values('${id(60)}','${id(21)}','${id(40)}','${id(50)}',current_date,now(),'PRESENT'),('${id(61)}','${id(22)}','${id(41)}','${id(51)}',current_date,now(),'LATE');
  `);
  const migration=fs.readFileSync(path.join(dir,'20260918102008_head_store_accounts_attendance.sql'),'utf8');
  await db.exec(migration);await db.exec(migration);
  assert.equal((await one(`select r.code from user_roles ur join roles r on r.id=ur.role_id where user_id='${id(2)}'`)).code,'HEAD_STORE');
  assert.equal((await one(`select is_admin('${id(2)}') as value`)).value,false);
  for(const fn of ['set_account_role(uuid,uuid,text,uuid)','prepare_crew_deletion(uuid,uuid,text)','head_store_workspace(uuid,date,date)']) {
   const access=await one(`select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as authenticated`,[fn]);
   assert.deepEqual(access,{anon:false,authenticated:false});
  }
  assert.equal((await one("select has_function_privilege('anon','is_admin(uuid)','EXECUTE') as allowed")).allowed,false);
  const workspace=async actor=>(await one(`select head_store_workspace($1,current_date,current_date) as data`,[actor])).data;
  const result=await workspace(id(2));
  assert.equal(result.city,'Bandung');assert.equal(result.branches.length,2);assert.equal(result.stores.length,2);assert.equal(result.crew.length,2);assert.equal(result.attendance.length,1);
  assert.ok(!JSON.stringify(result).includes('Jakarta'));assert.ok(!JSON.stringify(result).includes('outside@test'));
  await assert.rejects(workspace(id(3)),/Head Store/);
  const role=async(actor,target,code,branch=null)=>db.query('select set_account_role($1,$2,$3,$4)',[actor,target,code,branch]);
  await assert.rejects(role(id(2),id(3),'SUPER_ADMIN'),/Super Admin/);
  await assert.rejects(role(id(1),id(1),'CREW_STORE'),/sendiri/);
  await assert.rejects(role(id(1),id(3),'HEAD_STORE'),/kota/);
  await role(id(1),id(3),'HEAD_STORE',id(10));
  await assert.rejects(db.query("select manage_crew($1,'update',$2,null,'{\"fullName\":\"Should fail\"}'::jsonb)",[id(1),id(21)]),/admin/);
  await role(id(1),id(3),'CREW_STORE');
  // Direct data API reads and role changes must not bypass backend scope.
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id(2)}',false);`);
  assert.equal((await one('select count(*)::int as n from stores')).n,0);
  await assert.rejects(db.query(`insert into user_roles(user_id,role_id) values('${id(2)}',(select id from roles limit 1))`),/permission denied/);
  await assert.rejects(db.query(`select set_account_role('${id(2)}','${id(3)}','SUPER_ADMIN',null)`),/permission denied/);
  await db.exec('reset role');
  // FK author references no longer block Auth deletion, shared entities survive.
  await db.exec(`insert into events(id,event_code,event_name,event_date,pic_crew_id) values('${id(70)}','EV','Shared Event',current_date,'${id(21)}');
   insert into event_workflows values('${id(70)}','${id(3)}');
   insert into equipment_assets(id,asset_code,asset_type) values('${id(71)}','ASSET','Camera');
   insert into event_checklists(event_id,asset_id,phase,signed_by) values('${id(70)}','${id(71)}','PRE_EVENT','${id(21)}');
   insert into audit_logs(actor_user_id,action,entity_type,entity_id) values('${id(3)}','OLD_ACTION','crew','${id(21)}');
   insert into password_reset_otps values('crew@test.invalid',false);
   update attendance_logs set reviewed_by='${id(3)}' where id='${id(61)}';
   update crew set deleted_at=now(),status='INACTIVE' where id='${id(21)}';
  `);
  const prepare=(actor,email)=>db.query('select prepare_crew_deletion($1,$2,$3)',[actor,id(21),email]);
  await assert.rejects(prepare(id(2),'crew@test.invalid'),/Super Admin/);
  await assert.rejects(prepare(id(1),'wrong@test.invalid'),/Email/);
  await db.exec(`insert into storage.objects(owner_id) values('${id(3)}')`);
  await assert.rejects(prepare(id(1),'crew@test.invalid'),/Storage/);
  await db.exec('delete from storage.objects');
  await prepare(id(1),'crew@test.invalid');await prepare(id(1),'crew@test.invalid');
  assert.equal((await one(`select is_active from users where id='${id(3)}'`)).is_active,false);
  await assert.rejects(role(id(1),id(3),'SUPER_ADMIN'),/aktif/);
  await db.exec(`delete from auth.users where id='${id(3)}'`);
  for(const [table,field] of [['users','id'],['crew','user_id'],['user_roles','user_id'],['crew_deletion_requests','user_id']])
   assert.equal((await one(`select count(*)::int n from ${table} where ${field}='${id(3)}'`)).n,0);
  assert.equal((await one(`select count(*)::int n from attendance_logs where crew_id='${id(21)}'`)).n,0);
  assert.equal((await one(`select count(*)::int n from store_schedules where id='${id(50)}'`)).n,0);
  assert.equal((await one(`select count(*)::int n from password_reset_otps`)).n,0);
  assert.equal((await one(`select pic_crew_id from events where id='${id(70)}'`)).pic_crew_id,null);
  assert.equal((await one(`select reviewed_by from attendance_logs where id='${id(61)}'`)).reviewed_by,null);
  assert.equal((await one(`select count(*)::int n from audit_logs where action='CREW_DELETED'`)).n,1);
  await db.exec(`insert into auth.users(id,email) values('${id(5)}','crew@test.invalid')`);
  assert.equal((await one(`select count(*)::int n from users where email='crew@test.invalid'`)).n,1);
 }finally{await db.close();}
});
