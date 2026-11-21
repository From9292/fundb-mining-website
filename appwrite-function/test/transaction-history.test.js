const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const originalRequest = https.request;
const originalTableId = process.env.FUNDB_TRANSACTIONS_TABLE_ID;
const originalProjectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const originalEndpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function installMock(rows = []) {
  const calls = [];
  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    let body = '';
    request.write = chunk => { body += chunk; };
    request.destroy = err => request.emit('error', err);
    request.end = () => {
      const parsed = new URL(url);
      calls.push({ path: parsed.pathname, search: parsed.search, method: options.method, headers: options.headers, body });
      let statusCode = 200;
      let payload = {};
      if (parsed.pathname === '/v1/account') {
        payload = { $id: 'verified-user-42' };
      } else if (parsed.pathname.endsWith('/tables/ledger_internal_42/rows')) {
        payload = { rows, total: rows.length };
      } else {
        statusCode = 404;
        payload = { message: 'Unexpected route ' + parsed.pathname };
      }
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.setEncoding = () => {};
      queueMicrotask(() => {
        callback(response);
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });
    };
    return request;
  };
  return calls;
}

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    json(value, status, headers) {
      this.payload = value;
      this.statusCode = status;
      this.headers = headers;
      return value;
    }
  };
}

function invoke(handler, bodyJson = {}) {
  const res = makeResponse();
  return handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-user-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson
    },
    res,
    log() {},
    error() {}
  }).then(() => res);
}

test('transaction history fails closed when ledger table ID is missing or is a display label', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  for (const value of [undefined, 'FUNDB TRANSACTIONS']) {
    restoreEnv('FUNDB_TRANSACTIONS_TABLE_ID', value);
    const calls = installMock();
    delete require.cache[require.resolve('../index.js')];
    const handler = require('../index.js');
    const res = await invoke(handler, { action: 'transactionHistory' });
    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.code, 'TRANSACTION_LEDGER_NOT_CONFIGURED');
    assert.equal(calls.length, 1, 'only Appwrite JWT verification may occur before configuration is rejected');
    assert.equal(calls[0].path, '/v1/account');
  }
});

test('transaction history reads only the verified user rows and filters invalid amounts', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  process.env.FUNDB_TRANSACTIONS_TABLE_ID = 'ledger_internal_42';
  const calls = installMock([
    { type: 'reward', amount: 12.5, status: 'confirmed', reference: 'R-1', description: 'Test reward', createdAt: '2026-11-21T00:00:00Z' },
    { type: 'bad', amount: -1, status: 'confirmed' },
    { type: 'bad', amount: 'not-a-number', status: 'confirmed' }
  ]);
  delete require.cache[require.resolve('../index.js')];
  const handler = require('../index.js');
  const res = await invoke(handler, { action: 'transactionHistory', userId: 'attacker-controlled-user' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.transactions.length, 1);
  assert.equal(res.payload.transactions[0].amount, 12.5);
  const ledgerCall = calls.find(call => call.path.endsWith('/tables/ledger_internal_42/rows'));
  assert.ok(ledgerCall, 'must query the configured dedicated ledger table');
  const queries = new URLSearchParams(ledgerCall.search).getAll('queries[]').map(value => JSON.parse(value));
  const ownerQuery = queries.find(query => query.attribute === 'userId');
  assert.deepEqual(ownerQuery.values, ['verified-user-42'], 'owner filter must come from Appwrite-verified identity, never request JSON');
  assert.ok(queries.some(query => query.method === 'limit' && query.values[0] === 50));
  assert.equal(calls.filter(call => call.method === 'POST' || call.method === 'PATCH').length, 0, 'history endpoint must remain read-only');
});

test.after(() => {
  https.request = originalRequest;
  restoreEnv('FUNDB_TRANSACTIONS_TABLE_ID', originalTableId);
  restoreEnv('APPWRITE_FUNCTION_PROJECT_ID', originalProjectId);
  restoreEnv('APPWRITE_FUNCTION_API_ENDPOINT', originalEndpoint);
});
