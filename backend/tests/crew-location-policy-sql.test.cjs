const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
test('office assignments and location exceptions persist atomically with role boundaries', {skip: !process.env.PGLITE_MODULE}, async () => {
  const {PGlite} = require(process.env.PGLITE_MODULE), db = new PGlite();
  const one = async (sql, args=[]) => (await db.query(sql, args)).rows[0];
  const migrate = async name => db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8').replace('create extension if not exists "pgcrypto";', ''));
  const rpc = async (actor, op, crew, user, data) => one('select manage_crew($1,$2,$3,$4,$5) id', [id(actor), op, crew, user, JSON.stringify(data)]);
  try {
    await db.exec(`create schema auth; create schema private; create role anon; create role authenticated; create role service_role bypassrls;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
    for (const file of ['foundation.sql','workforce.sql','attendance.sql','equipment.sql','audit_rls.sql','admin_branches_crew.sql','crew_company_job.sql']) await migrate(file);
    await db.exec(`alter table stores add location_kind text not null default 'STORE';
      alter table roles drop constraint roles_code_check;
      create table crew_deletion_requests(user_id uuid);
      insert into roles(code,name) values('SUPER_ADMIN','Super'),('ADMIN_STORE','Admin'),('CREW_STORE','Crew'),('CREW_EVENT','Event'),('OFFICE_STAFF','Office');
      insert into auth.users(id,email) values('${id(1)}','super@test.invalid'),('${id(2)}','admin@test.invalid'),('${id(3)}','crew@test.invalid'),('${id(4)}','office@test.invalid');
      insert into user_roles(user_id,role_id) select '${id(1)}',id from roles where code='SUPER_ADMIN';
      insert into user_roles(user_id,role_id) select '${id(2)}',id from roles where code='ADMIN_STORE';
      insert into stores(id,code,name,branch_id,latitude,longitude,location_kind) values
        ('${id(10)}','OFFICE','Kantor',(select id from branches limit 1),-6.9,107.6,'OFFICE'),
        ('${id(11)}','STORE','Store',(select id from branches limit 1),-6.9,107.6,'STORE');
      insert into crew(id,user_id,employee_code,crew_type,join_date) values('${id(20)}','${id(3)}','OLD-CREW','CREW_STORE',current_date);
      insert into store_assignments(crew_id,store_id,start_date) values('${id(20)}','${id(10)}',current_date);`);
    await migrate('20261008043901_crew_office_flexible_attendance.sql');
    assert.equal((await one('select assignment_kind from crew where id=$1',[id(20)])).assignment_kind,'OFFICE');
    const branch = (await one('select branch_id from stores where id=$1',[id(10)])).branch_id;
    const created = await rpc(1,'create',null,id(4),{fullName:'Office Crew',employeeCode:'OFFICE-1',crewType:'CREW_STORE',assignmentKind:'OFFICE',attendanceLocationMode:'ANYWHERE',branchId:branch,assignTo:id(10)});
    let row = await one('select * from crew where id=$1',[created.id]);
    assert.equal(row.assignment_kind,'OFFICE'); assert.equal(row.attendance_location_mode,'ANYWHERE');
    await db.exec(`grant usage on schema public,private to service_role; grant select,insert,update,delete on all tables in schema public to service_role; set role service_role;`);
    await rpc(1,'update',created.id,null,{jobTitle:'Finance'});
    assert.equal((await one('select attendance_location_mode from crew where id=$1',[created.id])).attendance_location_mode,'ANYWHERE');
    await assert.rejects(rpc(2,'update',id(20),null,{attendanceLocationMode:'ANYWHERE'}),/Super Admin/);
    await assert.rejects(rpc(1,'update',created.id,null,{crewType:'CREW_STORE',assignmentKind:'OFFICE',branchId:branch,assignTo:id(11)}),/sesuai jenis/);
    await assert.rejects(rpc(1,'update',created.id,null,{attendanceLocationMode:'UNLIMITED'}),/tidak valid/);
    await db.query("insert into events(id,event_code,event_name,event_date) values($1,'TEMP-EVENT','Temporary Event',current_date)",[id(30)]);
    await db.query("insert into event_assignments(crew_id,event_id,position) values($1,$2,'Crew')",[created.id,id(30)]);
    await rpc(1,'update',created.id,null,{assignmentKind:'STORE',branchId:branch,assignTo:id(11),attendanceLocationMode:'ASSIGNED'});
    assert.equal((await one("select count(*)::int n from store_assignments where crew_id=$1 and status='ACTIVE'",[created.id])).n,1);
    assert.equal((await one("select status from store_assignments where crew_id=$1 and store_id=$2",[created.id,id(10)])).status,'ENDED');
    assert.equal((await one('select status from event_assignments where crew_id=$1',[created.id])).status,'ACTIVE');
    await db.query("delete from user_roles where user_id=$1",[id(4)]);
    await db.query("insert into user_roles(user_id,role_id) select $1,id from roles where code='OFFICE_STAFF'",[id(4)]);
    await rpc(1,'update',created.id,null,{assignmentKind:'OFFICE',branchId:branch,assignTo:id(10),attendanceLocationMode:'ANYWHERE'});
    assert.equal((await one('select r.code from user_roles ur join roles r on r.id=ur.role_id where user_id=$1',[id(4)])).code,'OFFICE_STAFF');
    await assert.rejects(rpc(1,'update',created.id,null,{crewType:'CREW_EVENT',assignmentKind:'EVENT'}),/Ubah role/);
    await db.query("insert into attendance_logs(crew_id,store_assignment_id,attendance_date,check_in,check_in_distance_m,check_in_location_mode) values($1,(select id from store_assignments where crew_id=$1 and status='ACTIVE' limit 1),current_date,now(),450000.75,'ANYWHERE')",[created.id]);
    assert.equal(Number((await one('select check_in_distance_m from attendance_logs where crew_id=$1',[created.id])).check_in_distance_m),450000.75);
    await db.exec('reset role;');
    await db.exec('grant usage on schema public,private to authenticated; grant select,update on crew to authenticated;');
    // Exercise the policy trigger independently of RLS (which is another layer).
    await db.exec('alter table crew disable row level security; set role authenticated;');
    await assert.rejects(db.query("update crew set attendance_location_mode='ASSIGNED' where id=$1",[created.id]),/admin aplikasi/);
    await assert.rejects(rpc(1,'update',created.id,null,{attendanceLocationMode:'ASSIGNED'}),/permission denied/);
    await db.exec('reset role;');
    const audit = await one("select new_data from audit_logs where entity_id=$1 and new_data->>'attendance_location_mode'='ANYWHERE' limit 1",[created.id]);
    assert.equal(audit.new_data.assignment_kind,'OFFICE');
  } finally {await db.close();}
});
