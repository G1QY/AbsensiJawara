// Called from the full migration integration fixture, with its existing roles.
const assert=require('node:assert/strict');
module.exports=async function(db,id){
  const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
  await db.query("insert into store_schedules(id,store_assignment_id,schedule_date,start_time,end_time,shift_number,break_start_time,break_end_time) values($1,$2,'2098-01-10','22:00','06:00',3,'02:00','03:00')",[id(180),id(41)]);
  await assert.rejects(db.query("update store_schedules set break_end_time='07:00' where id=$1",[id(180)]),/di dalam shift/);
  await db.query("insert into attendance_logs(id,crew_id,store_assignment_id,store_schedule_id,attendance_date,check_in,status) values($1,$2,$3,$4,'2098-01-10','2098-01-10T22:00:00+07:00','PRESENT')",[id(181),id(22),id(41),id(180)]);
  await assert.rejects(db.query("update store_schedules set break_start_time='01:00' where id=$1",[id(180)]),/dipakai/);
  await assert.rejects(db.query("update attendance_logs set break_started_at='2098-01-11T02:00:00+07:00' where id=$1",[id(181)]),/attendance_break_evidence/);
  await db.query("update attendance_logs set break_started_at='2098-01-11T02:00:00+07:00',break_start_photo_url='attendance/start.jpg',break_start_lat=-6.9,break_start_lng=107.6 where id=$1",[id(181)]);
  await assert.rejects(db.query("update attendance_logs set check_out='2098-01-11T06:00:00+07:00' where id=$1",[id(181)]),/attendance_break_evidence/);
  await db.query("update attendance_logs set break_ended_at='2098-01-11T03:00:00+07:00',break_end_photo_url='attendance/end.jpg',break_end_lat=-6.9,break_end_lng=107.6 where id=$1",[id(181)]);
  await db.query("update attendance_logs set check_out='2098-01-11T06:00:00+07:00' where id=$1",[id(181)]);
  await assert.rejects(db.query("update attendance_logs set break_ended_at=break_ended_at+interval '1 minute' where id=$1",[id(181)]),/terkunci/);
  assert.equal((await one("select count(*)::int n from audit_logs where entity_id=$1 and action in ('BREAK_STARTED','BREAK_ENDED')",[id(181)])).n,2);
  const request=(start,end,type='SICK',reason='Perlu istirahat')=>one('select request_crew_permission($1,$2,$3,$4,$5) id',[id(4),start,end,type,reason]);
  const p=await request('2098-01-20','2098-01-21');
  assert.equal((await one('select status from permissions where id=$1',[p.id])).status,'PENDING');
  await assert.rejects(request('2098-01-21','2098-01-22'),/bertumpuk/);
  await assert.rejects(request('2098-02-01','2098-03-15'),/maksimal/);
  await assert.rejects(request('2098-01-23','2098-01-23','DAY_OFF'),/izin\/sakit/);
  await assert.rejects(db.query("select review_crew_permission($1,$2,'APPROVED','')",[id(4),p.id]),/Super Admin/);
  await db.query("select review_crew_permission($1,$2,'APPROVED','Disetujui')",[id(1),p.id]);
  await assert.rejects(db.query("select review_crew_permission($1,$2,'APPROVED','')",[id(1),p.id]),/sudah ditinjau/);
  await assert.rejects(db.query("insert into attendance_logs(crew_id,attendance_date,check_in,status) values($1,'2098-01-20','2098-01-20T08:00:00+07:00','PRESENT')",[id(22)]),/libur atau izin/);
  await db.query("select set_crew_day_status($1,$2,'2098-01-25','2098-01-25','SICK','Dikonfirmasi crew')",[id(1),id(22)]);
  assert.equal((await one("select type from permissions where crew_id=$1 and start_date='2098-01-25'",[id(22)])).type,'SICK');
  const late=await request('2098-01-26','2098-01-26','PERMIT');
  await db.query("insert into attendance_logs(crew_id,store_assignment_id,attendance_date,check_in,status) values($1,$2,'2098-01-26','2098-01-26T08:00:00+07:00','PRESENT')",[id(22),id(41)]);
  await assert.rejects(db.query("select review_crew_permission($1,$2,'APPROVED','')",[id(1),late.id]),/memiliki absensi/);
  await db.query("select review_crew_permission($1,$2,'REJECTED','Crew tetap masuk')",[id(1),late.id]);
  for(const fn of ['request_crew_permission(uuid,date,date,text,text)','review_crew_permission(uuid,uuid,text,text)']) {
    assert.deepEqual(await one("select has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') b",[fn]),{a:false,b:false});
  }
};
