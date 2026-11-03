import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, signup, setToken, getToken, getLatestMatch, uploadResume } from '../src/api/auth.js';

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
beforeEach(() => {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {configurable:true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }});
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else Object.defineProperty(globalThis, "localStorage", originalStorage);
});

test('signup adapts the FastAPI token and sends the canonical request', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/signup');
    assert.deepEqual(JSON.parse(options.body), {name:'Candidate', email:'candidate@example.com', password:'synthetic-pass'});
    return Response.json({access_token:'synthetic-token'});
  };
  assert.equal((await signup('Candidate', 'candidate@example.com', 'synthetic-pass')).token, 'synthetic-token');
});

test('expired authentication preserves status and clears the token', async () => {
  setToken('expired');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer expired');
    return Response.json({detail:'Invalid or expired token'}, {status:401});
  };
  await assert.rejects(apiRequest('/auth/me'), {status:401, message:'Invalid or expired token'});
  assert.equal(getToken(), null);
});

test('assessment history distinguishes a missing result from a service failure', async () => {
  globalThis.fetch = async () => Response.json({detail:'Not found'}, {status:404});
  assert.equal(await getLatestMatch(), null);
  globalThis.fetch = async () => Response.json({detail:{message:'Temporarily unavailable'}}, {status:503});
  await assert.rejects(getLatestMatch(), {status:503, message:'Temporarily unavailable'});
});

test('multipart resume upload requires consent and lets fetch set its boundary', async () => {
  const file = new Blob(['synthetic resume'], {type:'application/pdf'});
  await assert.rejects(uploadResume(file), /consent/i);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/resume/upload');
    assert.equal(options.headers['X-Data-Consent'], 'true');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.ok(options.body instanceof FormData);
    return Response.json({id:'synthetic-resume'});
  };
  assert.equal((await uploadResume(file, true)).id, 'synthetic-resume');
});

test('HTML success responses and missing tokens cannot create a fake authenticated session', async () => {
  globalThis.fetch = async () => new Response('<html>SPA fallback</html>', {status:200});
  await assert.rejects(apiRequest('/auth/me'), {status:502});
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(signup('Candidate','candidate@example.com','synthetic-password'), {status:502});
  assert.equal(getToken(), null);
});

test('an old unauthorized response cannot clear a newly issued token', async () => {
  setToken('old-token');
  globalThis.fetch = async () => {
    setToken('fresh-token');
    return Response.json({detail:'Expired'}, {status:401});
  };
  await assert.rejects(apiRequest('/auth/me'), {status:401});
  assert.equal(getToken(), 'fresh-token');
});
