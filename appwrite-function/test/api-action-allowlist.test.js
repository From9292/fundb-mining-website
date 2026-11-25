const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const originalRequest = https.request;
const envNames = ['APPWRITE_FUNCTION_PROJECT_ID', 'APPWRITE_FUNCTION_API_ENDPOINT'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
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

function installAccountMock() {
  const calls = [];
  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.destroy = error => request.emit('error', error);
    request.end = () => {
      calls.push({ path: new URL(url).pathname, method: options.method });
      const response = new EventEmitter();
      response.statusCode = 200;
      response.setEncoding = () => {};
      queueMicrotask(() => {
        callback(response);
        response.emit('data', JSON.stringify({ $id: 'verified-user-allowlist-test' }));
        response.emit('end');
      });
    };
    return request;
  };
  return calls;
}

function loadHandler() {
  delete require.cache[require.resolve('../index.js')];
  return require('../index.js');
}

async function invoke(bodyJson, requestOrigin = 'https://fundb-production-hardening.fundb-mining-website.pages.dev') {
  const res = makeResponse();
  await loadHandler()({
    req: {
      method: 'POST',
      headers: {
        origin: requestOrigin,
        'x-appwrite-user-jwt': 'test-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson
    },
    res,
    log() {},
    error() {}
  });
  return res;
}

test('rejects unknown and non-string API actions before any profile or ledger operation', async () => {
  for (const action of ['withdraw', 'transfer', 'approveMission', 'adminOverride', { name: 'profileSync' }]) {
    const calls = installAccountMock();
    const res = await invoke({ action, userId: 'attacker', points: 999999, balance: 999999 });
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.code, 'UNSUPPORTED_ACTION');
    assert.deepEqual(calls.map(call => call.path), ['/v1/account']);
  }
});

test('rejects an untrusted browser origin before authenticating or accessing Appwrite data', async () => {
  const calls = installAccountMock();
  const res = await invoke({ action: 'transactionHistory' }, 'https://attacker.example');
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.ok, false);
  assert.equal(calls.length, 0);
});

test.after(() => {
  https.request = originalRequest;
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
