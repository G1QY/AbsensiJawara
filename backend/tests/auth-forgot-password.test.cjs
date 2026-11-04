const test = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../src/config/supabaseClient');
const profilePath = require.resolve('../src/modules/profile/profile.instance');
const emailPath = require.resolve('../src/utils/otpEmail');
let existingUser = true;

const database = {
  from(table) {
    let action = 'select';
    const query = {
      select() { return query; },
      eq() { return query; },
      order() { return query; },
      limit() { return query; },
      update() { action = 'update'; return query; },
      insert() { action = 'insert'; return query; },
      maybeSingle() {
        if (table === 'users') {
          return Promise.resolve({
            data: existingUser ? { id: 'user-id', email: 'crew@example.test' } : null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve({ data: null, error: null, action }).then(resolve, reject);
      },
    };
    return query;
  },
};

const modules = [
  [databasePath, database],
  [profilePath, { service: {}, sessionClient() {} }],
  [emailPath, { emailConfig() {}, sendOtpEmail: async () => ({ id: 'email-id' }) }],
];
const previous = modules.map(([path]) => require.cache[path]);
for (const [path, exports] of modules) {
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
}
const { forgotPassword } = require('../src/modules/auth/auth.controller');
for (let index = 0; index < modules.length; index++) {
  const [path] = modules[index];
  if (previous[index]) require.cache[path] = previous[index];
  else delete require.cache[path];
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('forgot password gives the same response for registered and unregistered addresses', async () => {
  const results = [];
  for (const [email, isRegistered] of [['crew@example.test', true], ['unknown@example.test', false]]) {
    existingUser = isRegistered;
    const res = response();
    await forgotPassword({ body: { email } }, res, error => { throw error; });
    results.push({ status: res.statusCode, body: res.body });
  }

  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].status, 202);
  assert.equal(results[0].body.message, 'Jika email tersebut terdaftar, kami akan mengirimkan kode verifikasi. Periksa kotak masuk dan folder spam. Jika kode tidak diterima, hubungi admin.');
});
