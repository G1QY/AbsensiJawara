const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfileService, validateProfile } = require('../src/modules/profile/profile.service');
const id = '11111111-1111-4111-8111-111111111111';
function fixture(options = {}) {
  const calls = [];
  const user = { id, email: 'crew@example.test', user_metadata: options.metadata || {} };
  let profile = { id, email: options.profileEmail || user.email, full_name: 'Crew Test', phone_number: '', is_active: true };
  const query = { select() { return this; }, eq(column, value) { calls.push(['eq', column, value]); return this; }, update(value) { calls.push(['update', value]); profile = { ...profile, ...value }; return this; }, async maybeSingle() { return { data: profile }; }, then(resolve) { resolve({ data: profile }); } };
  const db = { from(table) { calls.push(['table', table]); return query; }, auth: { admin: {
    async getUserById(value) { calls.push(['authUser', value]); return { data: { user } }; },
    async updateUserById(value, fields) { calls.push(['authUpdate', value, fields]); return options.metaError ? { error: new Error('unavailable') } : { data: { user } }; },
    async signOut(token, scope) { calls.push(['signOut', token, scope]); },
  } } };
  const service = createProfileService({ db,
    sessionClient: () => ({ auth: {
      async signInWithPassword(credentials) { calls.push(['reauth', credentials.email]); return options.wrongPassword ? { error: new Error('invalid') } : { data: { user: { id: options.otherUser || id }, session: { access_token: 'reauth-token' } } }; },
      async updateUser(fields) { calls.push(['requestEmail', fields]); return { data: { user: { ...user, new_email: fields.email } } }; },
    } }),
    signUrl: async key => { calls.push(['sign', key]); return 'https://private.test/signed'; },
    upload: async (key, bytes, type) => { calls.push(['upload', key, bytes.toString(), type]); },
    remove: async key => { calls.push(['remove', key]); },
    resize: async () => { if (options.invalidImage) throw new Error('Invalid pixels'); return Buffer.from('normalized-jpeg'); },
  });
  return { service, calls };
}
test('profile updates allowlist fields and target only authenticated id', async () => {
  const f = fixture(); await f.service.update(id, { fullName: '  Nama Baru  ', phone: '+628123456789', id: 'victim', role: 'SUPER_ADMIN', email: 'evil@test.test', isActive: true });
  const update = f.calls.find(c => c[0] === 'update')[1];
  assert.equal(update.full_name, 'Nama Baru'); assert.equal(update.phone_number, '+628123456789');
  for (const field of ['id','role','email','is_active']) assert.equal(field in update, false);
  assert.ok(f.calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === id));
});
test('invalid profile input is rejected', () => { for (const body of [{ fullName: '' }, { fullName: 'A' }, { fullName: 'Valid', phone: '<script>' }]) assert.throws(() => validateProfile(body)); });
test('never sign another user or attendance object from editable metadata', async () => {
  for (const key of ['attendance/private.jpg', 'avatars/other-user/a.jpg', `avatars/${id}/../../secret.jpg`]) { const f = fixture({ metadata: { avatar_key: key } }); const user = await f.service.get(id); assert.equal(user.avatarUrl, ''); assert.equal(f.calls.some(c => c[0] === 'sign'), false); }
});
test('confirmed Auth email syncs to public profile', async () => { const f = fixture({ profileEmail: 'old@example.test' }); const user = await f.service.get(id); assert.equal(user.email, 'crew@example.test'); assert.ok(f.calls.some(c => c[0] === 'update' && c[1].email === 'crew@example.test')); });
test('email change requires matching identity and correct current password', async () => {
  for (const options of [{ wrongPassword: true }, { otherUser: 'another-account' }]) { const f = fixture(options); await assert.rejects(f.service.requestEmail(id, { email: 'new@example.test', currentPassword: 'wrong' })); assert.equal(f.calls.some(c => c[0] === 'requestEmail'), false); }
});
test('email change uses user confirmation flow, never admin email overwrite', async () => {
  const f = fixture(); const result = await f.service.requestEmail(id, { email: 'new@example.test', currentPassword: 'password', id: 'other' });
  assert.equal(result.pendingEmail, 'new@example.test'); assert.ok(f.calls.some(c => c[0] === 'requestEmail')); assert.equal(f.calls.some(c => c[0] === 'authUpdate' || c[0] === 'update'), false); assert.ok(f.calls.some(c => c[0] === 'signOut' && c[2] === 'local'));
});
test('avatar is re-encoded and namespaced under own id', async () => {
  const f = fixture(); await f.service.setAvatar(id, { mimetype: 'image/png', buffer: Buffer.from('png-data') }); const upload = f.calls.find(c => c[0] === 'upload'); assert.ok(upload[1].startsWith(`avatars/${id}/`)); assert.equal(upload[2], 'normalized-jpeg'); assert.equal(upload[3], 'image/jpeg');
});
test('reject SVG, oversized upload and invalid pixels before storage', async () => {
  for (const [options, file] of [[{}, { mimetype: 'image/svg+xml', buffer: Buffer.from('svg') }], [{}, { mimetype: 'image/jpeg', buffer: Buffer.alloc(3*1024*1024+1) }], [{ invalidImage: true }, { mimetype: 'image/png', buffer: Buffer.from('fake') }]]) { const f=fixture(options); await assert.rejects(f.service.setAvatar(id,file)); assert.equal(f.calls.some(c=>c[0]==='upload'), false); }
});
test('failed metadata save cleans uploaded orphan, not previous avatar', async () => { const old=`avatars/${id}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`; const f=fixture({metaError:true,metadata:{avatar_key:old}}); await assert.rejects(f.service.setAvatar(id,{mimetype:'image/jpeg',buffer:Buffer.from('jpg')})); assert.ok(f.calls.some(c=>c[0]==='remove'&&c[1]!==old)); assert.equal(f.calls.some(c=>c[0]==='remove'&&c[1]===old),false); });
