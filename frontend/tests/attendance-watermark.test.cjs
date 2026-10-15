const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function load(file, dependencies) {
  const context = { exports: {}, AbortSignal, require: name => dependencies[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const { drawAttendanceWatermark } = load('attendanceWatermark.ts', { './i18n': { getLocale: () => 'id-ID' } });
test('watermark keeps actual GPS, assignment and long addresses inside portrait/landscape photos', () => {
  for (const [width, height] of [[480, 640], [640, 480], [1280, 720], [320, 240]]) {
    const drawn = [];
    const ctx = { canvas: { width, height }, font: '', fillRect() {},
      measureText(text) { return { width: text.length * parseFloat(this.font.split(' ')[1]) * 0.55 }; },
      fillText(text, x, y) { drawn.push({ text, x, y, width: this.measureText(text).width, size: parseFloat(this.font.split(' ')[1]) }); },
    };
    drawAttendanceWatermark(ctx, new Date('2026-10-15T05:00:00Z'), 'Kantor Bandung',
      { latitude: -7.7956, longitude: 110.3695, accuracy: 20 },
      { address: 'Jalan Malioboro ' + 'Nama tempat sangat panjang '.repeat(40), attribution: '© OpenStreetMap contributors' });
    const text = drawn.map(line => line.text).join('');
    assert.match(text, /Lokasi GPS: Jalan Malioboro/);
    assert.match(text, /GPS saat foto: -7.795600, 110.369500/);
    assert.doesNotMatch(text, /OpenStreetMap contributors/);
    assert.match(text, /±20 m/); assert.match(text, /Penugasan: Kantor Bandung/);
    assert.ok(drawn.every(line => line.x >= 0 && line.x + line.width <= width && line.y >= 0 && line.y + line.size <= height));
  }
});
test('reverse lookup scopes, deduplication, explicit retry and provider errors preserve GPS', async () => {
  const calls = []; let data = { results: [] }, failure;
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const { reverseAddress, addressLookupError } = load('geocoding.ts', { './apiClient': { ApiError, api: {
    post: async (url, body, options) => { calls.push({ url, body, options }); if (failure) throw failure; return data; },
  } } });
  await Promise.all([reverseAddress(0, 0, true), reverseAddress(0, 0, true)]);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/guest-location/reverse'); assert.equal(calls[0].options.auth, false);
  data = { results: [{ address: 'Jalan hasil pencarian', latitude: 1, longitude: 1 }] };
  assert.equal(await reverseAddress(0, 0, true), null);
  assert.equal((await reverseAddress(0, 0, true, true)).address, 'Jalan hasil pencarian'); assert.equal(calls.length, 2);
  await reverseAddress(0, 0, 'attendance'); assert.equal(calls[2].url, '/attendance/location'); assert.equal(calls[2].options.auth, true);
  await reverseAddress(0, 0); assert.equal(calls[3].url, '/locations/reverse');
  failure = new ApiError('busy', 429);
  await assert.rejects(reverseAddress(2, 3, true));
  assert.match(addressLookupError(failure), /ramai/);
  failure = undefined; await reverseAddress(2, 3, true); assert.equal(calls.length, 6, 'errors are not cached');
});
