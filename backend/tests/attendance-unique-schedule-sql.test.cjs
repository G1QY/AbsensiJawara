const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('setiap jadwal event dan store hanya dapat memiliki satu absensi', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260902040000_unique_attendance_per_schedule.sql'), 'utf8');
  assert.match(sql, /create unique index if not exists uq_attendance_event_schedule/i);
  assert.match(sql, /where event_schedule_id is not null/i);
  assert.match(sql, /create unique index if not exists uq_attendance_store_schedule/i);
  assert.match(sql, /where store_schedule_id is not null/i);
});

test('kalender nasional dan jadwal Store per tanggal diamankan oleh migrasi', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260902050000_national_calendar_and_store_schedule_ranges.sql'), 'utf8');
  const syncService = fs.readFileSync(path.join(__dirname, '../src/services/nationalHolidaySync.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/modules/stores/adminStoreSchedules.routes.js'), 'utf8');
  assert.match(sql, /create table if not exists public\.national_holidays/i);
  assert.match(sql, /create unique index if not exists uq_store_schedule_assignment_date/i);
  assert.match(sql, /create table if not exists public\.national_holiday_syncs/i);
  assert.match(sql, /replace_national_holidays/i);
  assert.match(sql, /COLLECTIVE_LEAVE/);
  assert.doesNotMatch(sql, /2026-08-17/);
  assert.match(syncService, /https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars/);
  assert.match(syncService, /GOOGLE_CALENDAR_API_KEY/);
  assert.match(syncService, /id\.indonesian#holiday@group\.v\.calendar\.google\.com/);
  assert.match(syncService, /singleEvents/);
  assert.match(syncService, /db\.rpc\('replace_national_holidays'/);
  assert.match(syncService, /hasCachedRows/);
  assert.match(routes, /router\.post\('\/holidays\/sync'/);
});
