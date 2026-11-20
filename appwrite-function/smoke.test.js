'use strict';

// Dependency-free boundary smoke tests for the Appwrite function.
// These tests deliberately avoid contacting Appwrite or touching real profiles.
const assert = require('node:assert/strict');
const path = require('node:path');

function loadHandler(env = {}) {
  const keys = [
    'APPWRITE_FUNCTION_PROJECT_ID',
    'FUNDB_DATABASE_ID',
    'FUNDB_PROFILE_TABLE_ID',
    'APPWRITE_FUNCTION_API_ENDPOINT',
    'FUNDB_ALLOWED_ORIGIN'
  ];
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  delete require.cache[require.resolve('./index.js')];
  return require('./index.js');
}

function responseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    json(body, statusCode, headers) {
      this.body = body;
      this.statusCode = statusCode;
      this.headers = headers;
      return this;
    },
    text(body, statusCode, headers) {
      this.body = body;
      this.statusCode = statusCode;
      this.headers = headers;
      return this;
    }
  };
}

async function invoke(handler, req) {
  const res = responseRecorder();
  const logs = [];
  const errors = [];
  await handler({
    req: { headers: {}, ...req },
    res,
    log: message => logs.push(message),
    error: message => errors.push(message)
  });
  return { res, logs, errors };
}

(async () => {
  const handler = loadHandler({ FUNDB_ALLOWED_ORIGIN: 'https://fundb.example' });

  const options = await invoke(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://fundb.example' }
  });
  assert.equal(options.res.statusCode, 204);
  assert.equal(options.res.headers['Access-Control-Allow-Origin'], 'https://fundb.example');

  const hostileOrigin = await invoke(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://attacker.example' }
  });
  assert.equal(hostileOrigin.res.statusCode, 204);
  assert.equal(hostileOrigin.res.headers['Access-Control-Allow-Origin'], undefined);

  const wrongMethod = await invoke(handler, {
    method: 'GET',
    headers: { origin: 'https://fundb.example' }
  });
  assert.equal(wrongMethod.res.statusCode, 405);
  assert.equal(wrongMethod.res.body.ok, false);

  const missingAuth = await invoke(handler, {
    method: 'POST',
    headers: { origin: 'https://fundb.example' },
    bodyJson: {}
  });
  assert.equal(missingAuth.res.statusCode, 401);
  assert.equal(missingAuth.res.body.ok, false);
  assert.match(missingAuth.res.body.message, /project configuration/);
  assert.equal(missingAuth.errors.length, 0);

  console.log('Appwrite API boundary smoke tests passed (CORS allow/deny, method guard, missing-auth fail-closed).');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
