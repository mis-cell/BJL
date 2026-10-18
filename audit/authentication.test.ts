import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../src/server/auth.ts';

function client(profile: any, userError = false, databaseError = false) {
  return {
    auth: { getUser: async () => ({ data: { user: userError ? null : { id: 'verified-id' } }, error: userError }) },
    from: () => ({ select: () => ({ eq: (_field: string, id: string) => {
      assert.equal(id, 'verified-id');
      return { single: async () => ({ data: profile, error: databaseError }) };
    } }) }),
  };
}
async function run(c: any, token: string | undefined, path = '/api/chat', body = {}) {
  let status = 200, continued = false;
  const req: any = { headers: { authorization: token }, path, body };
  const res: any = { status: (s: number) => { status = s; return res; }, json: () => res };
  await createAuthMiddleware(c)(req, res, () => { continued = true; });
  return { status, continued, session: req.userSession };
}
const operator = { status: 'Active', role: 'USER', level: 'L1', allowed_modules: '["ai_assistant"]' };
test('missing, legacy and expired tokens fail closed', async () => {
  for (const header of [undefined, 'bjl_sess_123', 'Bearer expired']) {
    assert.equal((await run(client(operator, true), header)).status, 401);
  }
});
test('database outages and inactive profiles fail closed', async () => {
  assert.equal((await run(client(operator, false, true), 'Bearer valid')).status, 503);
  assert.equal((await run(client({ ...operator, status: 'Inactive' }), 'Bearer valid')).status, 403);
  assert.equal((await run(client(null), 'Bearer valid')).status, 403);
});
test('request-supplied administrator claims are ignored', async () => {
  const result = await run(client(operator), 'Bearer valid', '/api/test-smtp', { role: 'ADMIN', level: 'L5', modules: ['*'] });
  assert.equal(result.status, 403);
});
test('authorized modules pass; unknown routes and modules are denied', async () => {
  assert.equal((await run(client(operator), 'Bearer valid')).continued, true);
  assert.equal((await run(client(operator), 'Bearer valid', '/api/send-email')).status, 403);
  assert.equal((await run(client(operator), 'Bearer valid', '/api/unknown')).status, 403);
  assert.equal((await run(client({ ...operator, allowed_modules: '*' }), 'Bearer valid', '/api/test-smtp')).status, 403);
});
test('prefix aliases use identical authorization', async () => {
  assert.equal((await run(client(operator), 'Bearer valid', '/Jute-Purchase-Automation/api/chat')).continued, true);
  assert.equal((await run(client(operator), 'Bearer valid', '/Jute-Purchase-Automation/api/send-email')).status, 403);
});
test('administration requires authoritative administrator role', async () => {
  assert.equal((await run(client({ ...operator, role: 'ADMIN' }), 'Bearer valid', '/api/test-smtp')).continued, true);
});
