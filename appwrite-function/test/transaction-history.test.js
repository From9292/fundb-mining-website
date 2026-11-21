const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const originalRequest = https.request;
const originalProjectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const originalEndpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
const originalDatabaseId = process.env.FUNDB_DATABASE_ID;

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function installMock({ tables = [{ $id: 'ledger_internal_42', name: 'FundB Transactions' }], rows = [] } = {}) {
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
      if (parsed.pathname === '/v1/account' && options.method === 'GET') {
        payload = { $id: 'verified-user-42' };
      } else if (parsed.pathname.endsWith('/tables') && options.method === 'GET') {
        payload = { tables };
      } else if (parsed.pathname.endsWith('/tables/ledger_internal_42/rows') && options.method === 'GET') {
        payload = { rows, total: rows.length };
      } else {
        statusCode = 404;
        payload = { message: 'Unexpected route ' + options.method + ' ' + parsed.pathname };
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
    headers: null,
    json(value, status, headers) {
      this.payload = value;
      this.statusCode = status;
      this.headers = headers;
      return value;
    },
    text(value, status, headers) {
      this.payload = value;
      this.statusCode = status;
      this.headers = headers;
      return value;
    }
  };
}

async function invoke(handler, bodyJson = { action: 'transactionHistory' }, bodyOverrides = {}) {
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-user-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson,
      ...bodyOverrides
    },
    res,
    log() {},
    error() {}
  });
  return res;
}

function loadHandler() {
  delete require.cache[require.resolve('../index.js')];
  return require('../index.js');
}

test('transaction history resolves the exact ledger display name and reads only the verified user rows', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  process.env.FUNDB_DATABASE_ID = 'fundB_database';
  const calls = installMock({
    tables: [
      { $id: 'unrelated_table', name: 'Transactions Archive' },
      { $id: 'ledger_internal_42', name: 'FundB Transactions' }
    ],
    rows: [
      { type: 'reward', amount: 12.5, status: 'confirmed', reference: 'R-1', description: 'Test reward', createdAt: '2026-11-21T00:00:00Z' },
      { type: 'bad', amount: -1, status: 'confirmed' },
      { type: 'bad', amount: 'not-a-number', status: 'confirmed' }
    ]
  });
  const res = await invoke(loadHandler(), { action: 'transactionHistory', userId: 'attacker-controlled-user' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.transactions.length, 1);
  assert.equal(res.payload.transactions[0].amount, 12.5);
  const tableListCall = calls.find(call => call.path.endsWith('/tables'));
  assert.ok(tableListCall, 'must discover tables in the configured database');
  assert.match(tableListCall.path, /tablesdb\/fundB_database\/tables$/);
  assert.match(tableListCall.search, /Transactions/);
  const ledgerCall = calls.find(call => call.path.endsWith('/tables/ledger_internal_42/rows'));
  assert.ok(ledgerCall, 'must use the Appwrite-returned internal table ID');
  const queries = new URLSearchParams(ledgerCall.search).getAll('queries[]').map(value => JSON.parse(value));
  const ownerQuery = queries.find(query => query.attribute === 'userId');
  assert.deepEqual(ownerQuery.values, ['verified-user-42'], 'owner filter must come from Appwrite-verified identity, never request JSON');
  assert.ok(queries.some(query => query.method === 'orderDesc' && query.attribute === '$createdAt'));
  assert.ok(queries.some(query => query.method === 'limit' && query.values[0] === 50));
  assert.equal(calls.filter(call => call.method === 'POST' || call.method === 'PATCH').length, 0, 'history endpoint must remain read-only');
});

test('transaction history returns an empty list when the exact ledger exists but has no rows', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  process.env.FUNDB_DATABASE_ID = 'fundB_database';
  const calls = installMock({ rows: [] });
  const res = await invoke(loadHandler());

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { ok: true, transactions: [] });
  assert.ok(calls.some(call => call.path.endsWith('/tables/ledger_internal_42/rows')));
});

test('transaction history fails closed if the exact ledger table is missing or ambiguous', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  process.env.FUNDB_DATABASE_ID = 'fundB_database';

  for (const tables of [
    [{ $id: 'other', name: 'Transactions Archive' }],
    [
      { $id: 'ledger_one', name: 'FundB Transactions' },
      { $id: 'ledger_two', name: 'FundB Transactions' }
    ]
  ]) {
    const calls = installMock({ tables });
    const res = await invoke(loadHandler());
    assert.equal(res.statusCode, 500);
    assert.equal(res.payload.ok, false);
    assert.match(res.payload.message, /FundB Transactions table|More than one table is named FundB Transactions/);
    assert.equal(calls.filter(call => call.path.includes('/rows')).length, 0, 'must not read from an unknown or ambiguous ledger');
  }
});

test('transaction history recognizes an already-parsed req.body object', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  process.env.FUNDB_DATABASE_ID = 'fundB_database';
  const calls = installMock({ rows: [] });
  const res = await invoke(loadHandler(), undefined, { bodyJson: undefined, body: { action: 'transactionHistory' } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { ok: true, transactions: [] });
  assert.ok(calls.some(call => call.path.endsWith('/tables/ledger_internal_42/rows')));
});

test('OPTIONS preflight is handled without contacting Appwrite and restricts origin echo', async () => {
  process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  const calls = installMock();
  const handler = loadHandler();
  const res = makeResponse();
  await handler({ req: { method: 'OPTIONS', headers: { origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev' } }, res, log() {}, error() {} });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://fundb-production-hardening.fundb-mining-website.pages.dev');
  assert.equal(calls.length, 0);
  const badOriginRes = makeResponse();
  await handler({ req: { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }, res: badOriginRes, log() {}, error() {} });
  assert.equal(badOriginRes.statusCode, 403);
  assert.equal(badOriginRes.headers['Access-Control-Allow-Origin'], undefined);
});

test('POST requests from untrusted browser origins are rejected before Appwrite access', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  const calls = installMock();
  const res = await invoke(loadHandler(), { action: 'transactionHistory' }, {
    headers: {
      origin: 'https://evil.example',
      'x-appwrite-user-jwt': 'test-user-jwt',
      'x-appwrite-key': 'test-function-key'
    }
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.ok, false);
  assert.equal(calls.length, 0);
});

test('missing auth headers fail closed before external requests', async () => {
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
  const calls = installMock();
  const handler = loadHandler();
  const res = makeResponse();
  await handler({ req: { method: 'POST', headers: {} }, res, log() {}, error() {} });
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.ok, false);
  assert.equal(calls.length, 0);
});

test.after(() => {
  https.request = originalRequest;
  restoreEnv('FUNDB_DATABASE_ID', originalDatabaseId);
  restoreEnv('APPWRITE_FUNCTION_PROJECT_ID', originalProjectId);
  restoreEnv('APPWRITE_FUNCTION_API_ENDPOINT', originalEndpoint);
});
