import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const picker = await readFile(new URL('../src/components/maps/GoogleLocationPicker.tsx', import.meta.url), 'utf8');
const events = await readFile(new URL('../src/pages/admin/EventWorkspace.tsx', import.meta.url), 'utf8');
const stores = await readFile(new URL('../src/pages/admin/DirectoryManager.tsx', import.meta.url), 'utf8');

test('form event dan store tidak lagi menampilkan input koordinat manual', () => {
  assert.match(events, /<GoogleLocationPicker/);
  assert.match(stores, /<GoogleLocationPicker/);
  assert.match(stores, /title="Lokasi Store"/);
  assert.doesNotMatch(events, /Latitude'|Longitude'/);
  assert.doesNotMatch(stores, />\s*Latitude\s*</);
  assert.doesNotMatch(stores, />\s*Longitude\s*</);
});

test('pemilih lokasi mengisi koordinat dari pencarian, klik peta, dan lokasi perangkat', () => {
  assert.match(picker, /maps\.Geocoder/);
  assert.match(picker, /addListener\('click'/);
  assert.match(picker, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(picker, /latitude: position\.lat\.toFixed\(7\)/);
  assert.match(picker, /VITE_GOOGLE_MAPS_API_KEY/);
});
