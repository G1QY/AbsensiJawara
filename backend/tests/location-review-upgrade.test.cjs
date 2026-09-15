const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const migration = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20260914101401_location_history_and_workflow_review.sql'),'utf8');
test('location history, attendance deletion and completed workflow stay consistent', {skip: !process.env.PGLITE_MODULE}, async () => {
 const {PGlite}=require(process.env.PGLITE_MODULE), db=new PGlite();
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const one=async sql=>(await db.query(sql)).rows[0];
 try {
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create table users(id uuid primary key,full_name text,is_active boolean);
   create table admin_members(user_id uuid);
   create function is_admin(uid uuid) returns boolean language sql as 'select exists(select 1 from public.admin_members where user_id=uid)';
   create table crew(id uuid primary key,user_id uuid references users(id));
   create table branches(id uuid primary key,name text);
   create table stores(id uuid primary key,name text,status text,branch_id uuid references branches(id));
   create table store_assignments(id uuid primary key,store_id uuid references stores(id) on delete cascade,status text,end_date date);
   create table guest_attendances(id uuid primary key,store_id uuid references stores(id),full_name text);
   create table attendance_logs(id uuid primary key,crew_id uuid references crew(id));
   create table overtimes(id uuid primary key,attendance_id uuid references attendance_logs(id));
   create table attendance_corrections(id uuid primary key,attendance_id uuid references attendance_logs(id) on delete cascade);
   create table events(id uuid primary key,status text);
   create table event_assignments(id uuid primary key,event_id uuid references events(id),status text);
   create table event_workflows(event_id uuid primary key references events(id),data jsonb default '{}',current_step int,max_reached int,updated_by uuid references users(id));
   create table audit_logs(id bigint generated always as identity,actor_user_id uuid references users(id),action text,entity_type text,entity_id uuid,old_data jsonb,new_data jsonb);
   insert into users values('${id(1)}','Admin Uji',true),('${id(2)}','Crew Uji',true),('${id(3)}','Admin Nonaktif',false);
   insert into admin_members values('${id(1)}'),('${id(3)}');
   insert into crew values('${id(4)}','${id(2)}');
   insert into branches values('${id(10)}','Jakarta'),('${id(11)}','Bandung');
  `);
  // Both installations without and with the optional attendance_duties table work.
  await db.exec(migration);
  await db.exec('create table attendance_duties(id uuid primary key,store_id uuid references stores(id))');
  await db.exec(migration); await db.exec(migration);
  assert.equal((await one("select city_name from branches where name='Jakarta'")).city_name,'Jakarta');
  await db.exec(`
   insert into stores(id,name,status,branch_id) values
    ('${id(20)}','Kosong','ACTIVE','${id(10)}'),('${id(21)}','Riwayat Guest','ACTIVE','${id(10)}'),
    ('${id(22)}','Penugasan Berakhir','ACTIVE','${id(10)}'),('${id(23)}','Penugasan Aktif','ACTIVE','${id(10)}'),
    ('${id(24)}','Duty Lama','ACTIVE','${id(10)}');
   insert into guest_attendances values('${id(30)}','${id(21)}','Guest Uji');
   insert into store_assignments values('${id(31)}','${id(22)}','ENDED',null),('${id(32)}','${id(23)}','ACTIVE',null);
   insert into attendance_duties values('${id(33)}','${id(24)}');
   update stores set branch_id='${id(11)}' where id='${id(21)}';
  `);
  for(const actor of [2,3]) await assert.rejects(db.query(`select remove_directory_location('${id(actor)}','${id(20)}')`),/Hanya admin aktif/);
  assert.equal((await one(`select remove_directory_location('${id(1)}','${id(20)}') as result`)).result.archived,false);
  for(const n of [21,22,24]) {
   assert.equal((await one(`select remove_directory_location('${id(1)}','${id(n)}') as result`)).result.archived,true);
   assert.equal((await one(`select status from stores where id='${id(n)}'`)).status,'INACTIVE');
  }
  assert.equal((await one('select count(*)::int as n from guest_attendances')).n,1);
  assert.equal((await one('select count(*)::int as n from store_assignments')).n,2);
  await assert.rejects(db.query(`select remove_directory_location('${id(1)}','${id(23)}')`),/1 penugasan aktif/);
  await assert.rejects(db.query(`insert into guest_attendances values('${id(34)}','${id(21)}','Baru')`),/diarsipkan/);
  await assert.rejects(db.query(`update store_assignments set status='ACTIVE' where id='${id(31)}'`),/diarsipkan/);
  await assert.rejects(db.query(`update stores set status='ACTIVE' where id='${id(21)}'`),/archived_store_inactive/);
  await db.exec(`update guest_attendances set full_name='Koreksi Nama' where id='${id(30)}'`);
  await db.exec(`insert into attendance_logs values('${id(40)}','${id(4)}'); insert into overtimes values('${id(41)}','${id(40)}'); insert into attendance_corrections values('${id(42)}','${id(40)}')`);
  await assert.rejects(db.query(`select delete_admin_attendance('${id(2)}','registered','${id(40)}','Data uji')`),/Hanya admin aktif/);
  await assert.rejects(db.query(`select delete_admin_attendance('${id(1)}','registered','${id(40)}','')`),/alasan/);
  await db.query(`select delete_admin_attendance('${id(1)}','registered','${id(40)}','Data uji')`);
  assert.equal((await one('select count(*)::int as n from overtimes')).n,0);
  assert.equal((await one('select count(*)::int as n from attendance_corrections')).n,0);
  assert.equal((await one("select old_data->'overtimes' as rows from audit_logs where action='ATTENDANCE_DELETED'")).rows.length,1);
  assert.equal((await one("select old_data->>'full_name' as name from audit_logs where action='ATTENDANCE_DELETED'")).name,'Crew Uji');
  await db.query(`select delete_admin_attendance('${id(1)}','guest','${id(30)}','Data uji')`);
  await assert.rejects(db.query(`select delete_admin_attendance('${id(1)}','guest','${id(30)}','Data uji')`),/tidak ditemukan/);
  assert.equal((await one("select has_function_privilege('authenticated','delete_admin_attendance(uuid,text,uuid,text)','EXECUTE') as allowed")).allowed,false);
  await db.exec(`insert into events values('${id(50)}','ONGOING'); insert into event_assignments values('${id(51)}','${id(50)}','ACTIVE');
   insert into event_workflows values('${id(50)}','{"omset_tunai":100}',14,14,'${id(2)}');
   update event_workflows set current_step=15,max_reached=15 where event_id='${id(50)}';`);
  assert.equal((await one('select status from events')).status,'COMPLETED');
  assert.equal((await one('select status from event_assignments')).status,'ENDED');
  assert.equal((await one("select new_data->>'actor_name' as name from audit_logs where action='WORKFLOW_COMPLETED'")).name,'Crew Uji');
  await assert.rejects(db.query("update event_workflows set data='{}'"),/hanya dapat ditinjau/);
  await assert.rejects(db.query('update event_workflows set current_step=1,max_reached=1'),/hanya dapat ditinjau/);
 } finally { await db.close(); }
});
