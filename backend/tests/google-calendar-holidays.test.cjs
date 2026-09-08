const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { normalizeRows } = require('../src/services/nationalHolidaySync');

test('Google Calendar all-day events diubah menjadi tanggal libur Indonesia', () => {
  const rows = normalizeRows([
    { summary: 'Hari Kemerdekaan Republik Indonesia', start: { date: '2026-08-17' }, end: { date: '2026-08-18' } },
    { summary: 'Cuti Bersama Idulfitri', start: { date: '2026-03-23' }, end: { date: '2026-03-25' } },
  ], 2026);

  assert.deepEqual(rows, [
    { holiday_date: '2026-03-23', name: 'Cuti Bersama Idulfitri', kind: 'COLLECTIVE_LEAVE' },
    { holiday_date: '2026-03-24', name: 'Cuti Bersama Idulfitri', kind: 'COLLECTIVE_LEAVE' },
    { holiday_date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia', kind: 'NATIONAL_HOLIDAY' },
  ]);
});

test('hari Minggu tidak dibuat sebagai libur tanpa event dari Google', () => {
  const rows = normalizeRows([
    { summary: 'Hari Buruh Internasional', start: { date: '2026-05-01' }, end: { date: '2026-05-02' } },
  ], 2026);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].holiday_date, '2026-05-01');
});
