import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const sessionSource = await readFile(new URL('../src/lib/authSession.ts', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../src/lib/apiClient.ts', import.meta.url), 'utf8');

async function browser({ saved = '{broken-json', blocked = false, status = 200 } = {}) {
  const storage = new Map([['fotosnaps_auth', saved], ['guest_reports', 'keep']]);
  const calls = [];
  let reloads = 0;
  const context = vm.createContext({
    localStorage: {
      removeItem(key) { if (blocked) throw new Error('Storage disabled'); storage.delete(key); },
      getItem() { throw new Error('Must not read saved authentication'); },
      setItem() { throw new Error('Must not persist authentication'); },
    },
    window: { location: { reload() { reloads++; } } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { status, ok: status < 400, headers: { get: () => 'application/json' }, json: async () => ({ message: 'test response' }) };
    },
  });
  const session = new vm.SourceTextModule(stripTypeScriptTypes(sessionSource), { context });
  await session.link(() => { throw new Error('Unexpected dependency'); });
  await session.evaluate();
  const client = new vm.SourceTextModule(stripTypeScriptTypes(apiSource), {
    context,
    initializeImportMeta(meta) { meta.env = {}; },
  });
  await client.link(() => session);
  await client.evaluate();
  return { session: session.namespace, api: client.namespace.api, storage, calls, reloads: () => reloads };
}

test('opening app ignores legacy account, corrupt JSON and preserves unrelated data', async () => {
  for (const saved of ['{broken-json', JSON.stringify({ token: 'old-token', role: 'SUPER_ADMIN' }), JSON.stringify({ role: 'GUEST_CREW' })]) {
    const b = await browser({ saved });
    assert.equal(b.session.getAccessToken(), null);
    assert.equal(b.storage.has('fotosnaps_auth'), false);
    assert.equal(b.storage.get('guest_reports'), 'keep');
    await assert.rejects(b.api.get('/crew'), { status: 401 });
    assert.equal(b.calls.length, 0);
  }
});

test('blocked storage does not prevent login', async () => {
  const b = await browser({ blocked: true });
  b.session.setAccessToken('new-token');
  await b.api.get('/crew');
  assert.equal(b.calls[0].options.headers.Authorization, 'Bearer new-token');
});

test('login token reaches JSON and photo requests without persistence', async () => {
  const b = await browser();
  b.session.setAccessToken('new-token');
  await b.api.get('/crew');
  await b.api.postForm('/attendance/check-in', {});
  assert.equal(b.calls.length, 2);
  for (const call of b.calls) assert.equal(call.options.headers.Authorization, 'Bearer new-token');
  assert.equal(b.storage.has('fotosnaps_auth'), false);
});

test('reopening/reloading starts a new session without the previous token', async () => {
  const first = await browser();
  first.session.setAccessToken('new-token');
  const reopened = await browser();
  assert.equal(reopened.session.getAccessToken(), null);
});

test('logout and guest entry cannot retain a real account token', async () => {
  const b = await browser();
  b.session.setAccessToken('new-token');
  b.session.clearAuthSession();
  await assert.rejects(b.api.postForm('/attendance/check-in', {}), { status: 401 });
  assert.equal(b.calls.length, 0);
});

test('protected JSON and photo 401 clear session and return to Login', async () => {
  for (const method of ['json', 'photo']) {
    const b = await browser({ status: 401 });
    b.session.setAccessToken('expired-token');
    await assert.rejects(method === 'json' ? b.api.get('/crew') : b.api.postForm('/attendance/check-in', {}), { status: 401 });
    assert.equal(b.session.getAccessToken(), null);
    assert.equal(b.reloads(), 1);
  }
});

test('public 401 shows the server error without reloading the login form', async () => {
  const b = await browser({ status: 401 });
  await assert.rejects(b.api.post('/auth/login', {}, { auth: false }), { message: 'test response', status: 401 });
  assert.equal(b.reloads(), 0);
});

test('non-auth server failures do not log out the user', async () => {
  const b = await browser({ status: 503 });
  b.session.setAccessToken('new-token');
  await assert.rejects(b.api.get('/crew'), { status: 503 });
  assert.equal(b.session.getAccessToken(), 'new-token');
  assert.equal(b.reloads(), 0);
});

test('React integration starts logged out and uses the memory session', async () => {
  const source = await readFile(new URL('../src/lib/AuthContext.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<AuthState \| null>\(null\)/);
  assert.doesNotMatch(source, /localStorage|loadStoredAuth/);
  assert.match(source, /setAccessToken\(nextAuth.token\)/);
  assert.match(source, /const logout[\s\S]*?clearAuthSession\(\)/);
  assert.match(source, /const loginAsGuest[\s\S]*?clearAuthSession\(\)/);
});

test('role guard prevents mounting the previous account page', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /currentPage.startsWith\(prefix\)/);
  assert.match(source, /switch \(activePage\)/);
});
