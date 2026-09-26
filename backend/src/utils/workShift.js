const {wibDate,combineDateTime,scheduledEnd}=require('./attendanceTime');
function shiftNumber(value=1) {
  const number=Number(value);
  if(!Number.isInteger(number)||number<1||number>3) throw Object.assign(new Error('Pilih Shift 1, 2, atau 3.'),{status:422});
  return number;
}
const adjacentDate=(date,offset)=>new Date(Date.parse(date+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
function overlaps(a,b) {
  return combineDateTime(a.schedule_date,a.start_time)<scheduledEnd(b)&&combineDateTime(b.schedule_date,b.start_time)<scheduledEnd(a);
}
function canClockIn(schedule,now) {
  if(schedule.schedule_date===wibDate(now))return true;
  // A late arrival after midnight belongs to the previous day's overnight shift.
  return schedule.schedule_date===adjacentDate(wibDate(now),-1)&&schedule.end_time<schedule.start_time&&now<scheduledEnd(schedule);
}
module.exports={shiftNumber,adjacentDate,overlaps,canClockIn};
