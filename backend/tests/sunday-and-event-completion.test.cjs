const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..', 'src');
const scheduleRoute = readFileSync(join(root, 'modules/stores/adminStoreSchedules.routes.js'), 'utf8');
const attendance = readFileSync(join(root, 'modules/attendance/attendance.controller.js'), 'utf8');
const workflow = readFileSync(join(root, 'modules/events/crewEventWorkspace.routes.js'), 'utf8');

test('Minggu dapat dijadwalkan dan hanya kalender nasional menjadi libur otomatis', () => {
  assert.match(scheduleRoute, /day < 0 \|\| day > 6/);
  assert.doesNotMatch(scheduleRoute, /day === 0 \|\| holidays/);
  assert.match(attendance, /if \(!holiday\) continue/);
  assert.doesNotMatch(attendance, /Libur Minggu|SUNDAY/);
});

test('workflow selesai memperbarui status event dan penugasan', () => {
  assert.match(workflow, /saved\.max_reached >= 15/);
  assert.match(workflow, /update\(\{ status: 'COMPLETED' \}\)/);
  assert.match(workflow, /update\(\{ status: 'ENDED' \}\)/);
});
