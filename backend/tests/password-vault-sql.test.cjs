const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../supabase/migrations');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('encrypted password vault permissions, invalidation and promoted profile edits',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
   create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}',encrypted_password text,updated_at timestamptz);
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

  for(const file of ['20260918102008_head_store_accounts_attendance.sql','20260924073548_crew_password_vault_profile_roles.sql']) await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
  await db.exec(fs.readFileSync(path.join(dir,'20260924073548_crew_password_vault_profile_roles.sql'),'utf8'));
  const roleOf=async user=>(await one('select r.code from user_roles ur join roles r on r.id=ur.role_id where user_id=$1',[user])).code;
  await db.query('select manage_crew($1,$2,$3,null,$4)',[id(1),'update',id(20),JSON.stringify({fullName:'Head edited',crewType:'CREW_STORE',companyName:'JAWARA'})]);
  assert.equal(await roleOf(id(2)),'HEAD_STORE');
  assert.equal((await one('select city_name from head_store_scopes where user_id=$1',[id(2)])).city_name.trim(),'Bandung');
  await db.query('select set_account_role($1,$2,$3,null)',[id(1),id(2),'EVENT_MANAGER']);
  await db.query('select manage_crew($1,$2,$3,null,$4)',[id(1),'update',id(20),JSON.stringify({jobTitle:'Manager edited'})]);
  assert.equal(await roleOf(id(2)),'EVENT_MANAGER');
  await assert.rejects(db.query('select manage_crew($1,$2,$3,null,$4)',[id(1),'update',id(20),JSON.stringify({crewType:'CREW_EVENT'})]),/Ubah role/);
  await db.query('select set_account_role($1,$2,$3,$4)',[id(1),id(4),'HEAD_STORE',id(10)]);
  await assert.rejects(db.query('select manage_crew($1,$2,$3,null,$4)',[id(2),'update',id(22),JSON.stringify({fullName:'Unauthorized'})]),/tidak boleh/);
  await db.query('update auth.users set encrypted_password=$1,updated_at=$2 where id=$3',['fixture-hash','2026-09-24T01:00:00Z',id(3)]);
  const save=()=>db.query('select save_crew_password_copy($1,$2,$3,$4)',[id(1),id(3),'2026-09-24T01:00:00Z','aXY=.dGFn.Y2lwaGVydGV4dA==']);
  const read=async actor=>(await one('select read_crew_password_copy($1,$2) as result',[actor,id(21)])).result;
  await db.exec('set role service_role');await save();assert.equal((await read(id(1))).user_id,id(3));await db.exec('reset role');
  assert.equal((await read(id(1))).ciphertext,'aXY=.dGFn.Y2lwaGVydGV4dA==');
  for(const actor of [id(2),id(3),id(4)]) await assert.rejects(read(actor),/Super Admin/);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);
    await assert.rejects(read(id(1)),/permission denied/);
    await assert.rejects(save(),/permission denied/);
    await assert.rejects(db.query('select * from private.crew_password_copies'),/permission denied/);
    await db.exec('reset role');
  }
  await db.query('update auth.users set encrypted_password=$1,updated_at=$2 where id=$3',['changed-outside-app','2026-09-24T02:00:00Z',id(3)]);
  assert.equal(await read(id(1)),null);
  assert.equal((await one('select count(*)::int n from private.crew_password_copies')).n,0);
  await assert.rejects(save(),/Password telah berubah/);
  const audit=await db.query("select new_data from audit_logs where action like 'CREW_PASSWORD%'");
  assert.ok(audit.rows.length>0);assert.ok(!JSON.stringify(audit.rows).includes('Y2lwaGVydGV4dA'));
  await db.query('update users set is_active=false where id=$1',[id(1)]);
  await assert.rejects(read(id(1)),/Super Admin/);
 }finally{await db.close()}
});
