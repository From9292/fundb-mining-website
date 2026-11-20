'use strict';

// Dependency-free boundary smoke tests for the Appwrite function.
// These tests deliberately avoid contacting Appwrite or touching real profiles.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

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

// Static regression guard for the restored read-only transaction history endpoint.
const backendSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
assert.match(backendSource, /if \(requestBody\.action === 'transactionHistory'\)/);
assert.match(backendSource, /listUserTransactions\(user\.\$id, adminHeaders\)/);
const historyActionOffset = backendSource.indexOf("requestBody.action === 'transactionHistory'");
const adminHeadersOffset = backendSource.indexOf("const adminHeaders =");
assert.ok(adminHeadersOffset >= 0 && adminHeadersOffset < historyActionOffset,
  'adminHeaders must be initialized before the transaction-history action');
assert.match(backendSource, /attribute: 'userId', values: \[userId\]/);
assert.match(backendSource, /FUNDB_TRANSACTIONS_TABLE_ID/);
assert.match(backendSource, /orderDesc/);
assert.doesNotMatch(backendSource, /action === 'transactionHistory'[\\s\\S]{0,500}statusCode: 501/);

(async () => {
  const handler = loadHandler({
    FUNDB_ALLOWED_ORIGIN: 'https://fundb.example, https://fundb-preview.example'
  });

  const options = await invoke(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://fundb.example' }
  });
  assert.equal(options.res.statusCode, 204);
  assert.equal(options.res.headers['Access-Control-Allow-Origin'], 'https://fundb.example');

  const previewOptions = await invoke(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://fundb-preview.example' }
  });
  assert.equal(previewOptions.res.statusCode, 204);
  assert.equal(previewOptions.res.headers['Access-Control-Allow-Origin'], 'https://fundb-preview.example');

  const hostileOrigin = await invoke(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://fundb.example.attacker.example' }
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

  console.log('Appwrite API boundary smoke tests passed (single/multiple exact CORS origins, hostile-origin deny, method guard, missing-auth fail-closed).');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
