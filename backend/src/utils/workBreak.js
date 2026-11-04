const { combineDateTime, scheduledEnd } = require('./attendanceTime');
const fail = message => Object.assign(new Error(message), { status: 422 });
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

// Clock offsets are relative to the beginning of the shift, including midnight.
function breakFields(startTime, endTime, breakStart, breakEnd) {
  if (!breakStart && !breakEnd) return { break_start_time: null, break_end_time: null };
  const valid = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value);
  if (![startTime, endTime, breakStart, breakEnd].every(valid)) throw fail('Isi jam mulai dan selesai istirahat dengan benar.');
  const start = minutes(startTime);
  const offset = value => (minutes(value) - start + 1440) % 1440;
  if (!(offset(breakStart) > 0 && offset(breakStart) < offset(breakEnd) && offset(breakEnd) < offset(endTime))) {
    throw fail('Istirahat harus berada di dalam shift, setelah jam masuk dan sebelum jam pulang.');
  }
  return { break_start_time: breakStart.slice(0, 5), break_end_time: breakEnd.slice(0, 5) };
}

function breakWindow(schedule) {
  if (!schedule?.break_start_time || !schedule.break_end_time) return null;
  const start = combineDateTime(schedule.schedule_date, schedule.start_time);
  const at = value => new Date(start.getTime() + ((minutes(value) - minutes(schedule.start_time) + 1440) % 1440) * 60000);
  return { start: at(schedule.break_start_time), end: at(schedule.break_end_time), shiftEnd: scheduledEnd(schedule) };
}
module.exports = { breakFields, breakWindow };
