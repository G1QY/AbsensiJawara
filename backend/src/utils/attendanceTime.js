const wibDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
const combineDateTime = (date, time) => new Date(`${date}T${time}+07:00`);
function scheduledEnd(schedule) {
  const end=combineDateTime(schedule.schedule_date,schedule.end_time);
  const start=combineDateTime(schedule.schedule_date,schedule.start_time);
  if(end<=start)end.setTime(end.getTime()+86400000);
  return end;
}
const overtimeMinutes=(out,end)=>Math.max(0,Math.floor((out.getTime()-end.getTime())/3600000)*60);
const lateMinutes=(arrival,start)=>Math.max(0,Math.ceil((arrival.getTime()-start.getTime())/60000));
module.exports={wibDate,combineDateTime,scheduledEnd,overtimeMinutes,lateMinutes};
