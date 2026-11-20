'use strict';

// Dependency-free boundary smoke tests for the Appwrite function.
// These tests deliberately avoid contacting Appwrite or touching real profiles.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const { EventEmitter } = require('node:events');

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

  // Exercise the authenticated read-only history action with a mocked Appwrite
  // transport. The caller cannot choose the user ID; it comes from /account.
  const historyHandler = loadHandler({
    APPWRITE_FUNCTION_PROJECT_ID: 'fundb-test-project',
    FUNDB_ALLOWED_ORIGIN: 'https://fundb.example'
  });
  const originalRequest = https.request;
  const captured = [];
  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.destroy = error => request.emit('error', error);
    request.end = () => {
      captured.push({ url: String(url), method: options.method });
      const response = new EventEmitter();
      response.setEncoding = () => {};
      const isAccount = new URL(String(url)).pathname.endsWith('/v1/account');
      const payload = isAccount
        ? { $id: 'authenticated-user-123' }
        : { rows: [{
            $id: 'tx-1', type: 'Test entry', amount: 12.5, status: 'Recorded',
            reference: 'TEST-REF', description: 'Read-only test', $createdAt: '2026-11-20T00:00:00.000Z'
          }] };
      callback(response);
      process.nextTick(() => {
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });
    };
    return request;
  };
  try {
    const history = await invoke(historyHandler, {
      method: 'POST',
      headers: {
        origin: 'https://fundb.example',
        'x-appwrite-user-jwt': 'test-user-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson: { action: 'transactionHistory', userId: 'attacker-selected-user' }
    });
    assert.equal(history.res.statusCode, 200);
    assert.equal(history.res.body.ok, true);
    assert.equal(history.res.body.transactions.length, 1);
    assert.equal(history.res.body.transactions[0].id, 'tx-1');
    assert.equal(captured.length, 2, 'history must verify identity and perform one read');
    assert.ok(captured.every(item => item.method === 'GET'), 'history action must be read-only');
    const historyUrl = new URL(captured[1].url);
    const queryText = historyUrl.searchParams.getAll('queries[]').join(' ');
    assert.match(queryText, /authenticated-user-123/);
    assert.doesNotMatch(queryText, /attacker-selected-user/);
  } finally {
    https.request = originalRequest;
  }

  console.log('Appwrite API boundary and authenticated transaction-history smoke tests passed (exact CORS, method/auth guards, identity-scoped read-only history).');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
