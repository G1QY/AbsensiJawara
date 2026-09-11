const db = require('../config/supabaseClient');
const { officialRows, source: officialSource } = require('./officialHolidays');

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const DEFAULT_CALENDAR_ID = 'en.indonesian.official#holiday@group.v.calendar.google.com';
const CACHE_DAYS = 30;
const failedYears=new Map();

function holidayError(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

function validateYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw holidayError('Tahun kalender harus antara 2020 dan 2100.', 422);
  }
  return year;
}

function calendarConfig() {
  const apiKey = String(process.env.GOOGLE_CALENDAR_API_KEY || '').trim();
  const calendarId = String(process.env.GOOGLE_HOLIDAY_CALENDAR_ID || DEFAULT_CALENDAR_ID).trim();
  if (!apiKey) throw holidayError('GOOGLE_CALENDAR_API_KEY belum diisi pada backend.');
  if (!calendarId) throw holidayError('GOOGLE_HOLIDAY_CALENDAR_ID tidak valid.');
  return { apiKey, calendarId };
}

function providerUrl(year, pageToken, overrideId) {
  const { apiKey, calendarId: configuredId } = calendarConfig();
  const calendarId=overrideId || configuredId;
  const url = new URL(`${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('timeMin', `${year}-01-01T00:00:00+07:00`);
  url.searchParams.set('timeMax', `${year + 1}-01-01T00:00:00+07:00`);
  url.searchParams.set('timeZone', 'Asia/Jakarta');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '2500');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  return { url, calendarId };
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeRows(items, year) {
  if (!Array.isArray(items)) throw holidayError('Format respons Google Calendar tidak dikenali.');
  const byDate = new Map();

  for (const item of items) {
    const name = String(item?.summary || item?.description || '').trim();
    const start = String(item?.start?.date || item?.start?.dateTime || '').slice(0, 10);
    const isAllDay = Boolean(item?.start?.date);
    const endExclusive = isAllDay ? String(item?.end?.date || nextDate(start)).slice(0, 10) : nextDate(start);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start)) continue;

    const kind = /cuti bersama|collective leave|joint holiday/i.test(name) ? 'COLLECTIVE_LEAVE' : 'NATIONAL_HOLIDAY';
    for (let holidayDate = start; holidayDate && holidayDate < endExclusive; holidayDate = nextDate(holidayDate)) {
      if (!holidayDate.startsWith(`${year}-`)) continue;
      const existing = byDate.get(holidayDate);
      byDate.set(holidayDate, {
        holiday_date: holidayDate,
        name: existing && existing.name !== name ? `${existing.name} / ${name}` : name,
        kind: existing?.kind === 'COLLECTIVE_LEAVE' || kind === 'COLLECTIVE_LEAVE' ? 'COLLECTIVE_LEAVE' : 'NATIONAL_HOLIDAY',
      });
    }
  }

  const rows = [...byDate.values()].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  if (!rows.length) throw holidayError(`Google Calendar tidak mengembalikan data libur untuk ${year}.`);
  return rows;
}

async function cachedSync(year) {
  const { data, error } = await db.from('national_holiday_syncs')
    .select('year,provider_url,synced_at,row_count').eq('year', year).maybeSingle();
  if (error) throw holidayError('Migrasi sinkronisasi kalender belum dijalankan.');
  return data;
}

async function hasCachedRows(year) {
  const { count, error } = await db.from('national_holidays').select('holiday_date', { count: 'exact', head: true })
    .gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
  if (error) throw holidayError('Kalender libur nasional belum siap.');
  return Number(count) > 0;
}

async function fetchGoogleHolidayRows(year, signal) {
  const items = [];
  let pageToken = '';
  let calendarId = DEFAULT_CALENDAR_ID;
  let overrideId;
  let retried=false;
  do {
    const request = providerUrl(year, pageToken, overrideId);
    calendarId = request.calendarId;
    const response = await fetch(request.url, { headers: { accept: 'application/json' }, signal });
    const body = await response.json().catch(() => ({}));
    if(response.status===404&&!retried&&['id.indonesian#holiday@group.v.calendar.google.com','en.indonesian#holiday@group.v.calendar.google.com'].includes(calendarId)){overrideId=DEFAULT_CALENDAR_ID;retried=true;pageToken='';continue;}
    if (!response.ok) throw holidayError(body?.error?.message || `Google Calendar API merespons HTTP ${response.status}.`);
    if (!Array.isArray(body.items)) throw holidayError('Format respons Google Calendar tidak dikenali.');
    items.push(...body.items);
    pageToken = String(body.nextPageToken || '');
  } while (pageToken || (retried && calendarId !== overrideId));
  return { rows: normalizeRows(items, year), provider: `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(calendarId)}/events` };
}

async function syncHolidayYear(value, { force = false } = {}) {
  const year = validateYear(value);
  const failed=failedYears.get(year);
  if(!force&&failed&&failed.until>Date.now())return failed.result;
  const cached = await cachedSync(year);
  const freshAfter = Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000;
  if (!force && cached && new Date(cached.synced_at).getTime() >= freshAfter && await hasCachedRows(year)) {
    return { ...cached, cached: true, fallback: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let provider = `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(process.env.GOOGLE_HOLIDAY_CALENDAR_ID || DEFAULT_CALENDAR_ID)}/events`;
  try {
    const result = await fetchGoogleHolidayRows(year, controller.signal);
    provider = result.provider;
    const { data, error } = await db.rpc('replace_national_holidays', {
      p_year: year,
      p_provider: provider,
      p_rows: result.rows,
    });
    if (error) throw holidayError('Data kalender dari Google gagal disimpan ke Supabase.');
    failedYears.delete(year);
    return { year, provider_url: provider, synced_at: new Date().toISOString(), row_count: Number(data), cached: false, fallback: false };
  } catch (error) {
    const rows = officialRows(year);
    if (rows.length) {
      const { data, error: saveError } = await db.rpc('replace_national_holidays', {
        p_year: year, p_provider: officialSource, p_rows: rows,
      });
      if (!saveError) {
        failedYears.delete(year);
        return { year, provider_url: officialSource, synced_at: new Date().toISOString(),
          row_count: Number(data), cached: false, fallback: true };
      }
    }
    if (await hasCachedRows(year)) {
      return { ...(cached || { year, provider_url: provider, synced_at: null, row_count: null }), cached: true, fallback: true, warning: 'Pembaruan hari libur tertunda. Kalender menggunakan data terakhir yang tersimpan.' };
    }
    const unavailable={year,cached:false,fallback:true,row_count:0,warning:`Data libur ${year} belum tersedia dari Google Calendar. Jadwal mengikuti hari kerja pilihan; periksa libur kembali setelah sinkronisasi tersedia.`};
    failedYears.set(year,{until:Date.now()+60000,result:unavailable});
    return unavailable;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureHolidayYears(years) {
  const results = [];
  for (const year of [...new Set(years.map(Number))]) results.push(await syncHolidayYear(year));
  return results;
}

module.exports = { syncHolidayYear, ensureHolidayYears, validateYear, normalizeRows };
