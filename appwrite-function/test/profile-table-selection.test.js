const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const originalRequest = https.request;
const originalProjectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const originalEndpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
const originalDatabaseId = process.env.FUNDB_DATABASE_ID;
const originalLegacyDatabaseId = process.env.FUNBDATAID;
delete process.env.FUNDB_DATABASE_ID;
process.env.FUNBDATAID = '6aedcd650007f44a070f';
process.env.APPWRITE_FUNCTION_PROJECT_ID = 'fundb-ci-test-project';
process.env.APPWRITE_FUNCTION_API_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const user = { $id: 'user-existing-123' };
const canonicalProfile = {
  $id: 'canonical-row-1',
  userId: user.$id,
  points: 17,
  referralCode: 'FB12345678',
  total_referrals: 2,
  referred_by: ''
};
const legacyProfile = {
  $id: 'legacy-row-1',
  userId: user.$id,
  points: 999,
  referralCode: 'FB87654321',
  total_referrals: 99,
  referred_by: ''
};
let writes;
let requests;

function installAppwriteMock(options = {}) {
  writes = [];
  requests = [];
  https.request = (url, requestOptions, callback) => {
    const request = new EventEmitter();
    let body = '';
    request.write = chunk => { body += chunk; };
    request.destroy = err => request.emit('error', err);
    request.end = () => {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const method = requestOptions.method;
      requests.push({ path, search: parsed.search, method });
      let status = 200;
      let payload = {};
      if (path.endsWith('/account') && method === 'GET') {
        payload = user;
      } else if (path.endsWith('/tables') && method === 'GET') {
        payload = { tables: [
          { $id: 'canonical-upper-id', name: 'Profile' },
          { $id: 'legacy-lower-id', name: 'profile' }
        ] };
      } else if (path.endsWith('/tables/canonical-upper-id/rows') && method === 'GET') {
        payload = { rows: [canonicalProfile], total: 1 };
      } else if (path.endsWith('/tables/legacy-lower-id/rows') && method === 'GET') {
        payload = { rows: [legacyProfile], total: 1 };
      } else if (options.legacyFallbackReachable && path.endsWith('/tables/6afea0720025daaed040/rows') && method === 'GET') {
        const queries = new URLSearchParams(parsed.search).getAll('queries[]').map(value => JSON.parse(value));
        const userLookup = queries.some(query => query.attribute === 'userId');
        const referralLookup = queries.some(query => query.attribute === 'referralCode');
        if (options.legacyFallbackProfile && userLookup) {
          payload = { rows: [options.legacyFallbackProfile], total: 1 };
        } else if (options.legacyFallbackProfile && referralLookup) {
          payload = { rows: [{ $id: 'referrer-row', userId: 'other-user-456', referralCode: 'FB12345678', total_referrals: 0 }], total: 1 };
        } else {
          payload = { rows: [], total: 0 };
        }
      } else if (path.includes('/tables/') && path.endsWith('/rows') && method === 'GET') {
        status = 404;
        payload = { message: 'Table not found', type: 'table_not_found' };
      } else if (method === 'PATCH' || method === 'POST' || path.includes('/increment')) {
        writes.push({ path, method, body });
        status = 500;
        payload = { message: 'Unexpected write in read-only test' };
      } else {
        status = 404;
        payload = { message: 'Unexpected mocked route: ' + method + ' ' + path };
      }
      if (options.discoveryDenied && path.endsWith('/tables')) {
        status = 403;
        payload = { message: 'Missing tables.read scope', type: 'general_access_forbidden' };
      }
      const response = new EventEmitter();
      response.statusCode = status;
      response.setEncoding = () => {};
      queueMicrotask(() => {
        callback(response);
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });
    };
    return request;
  };
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

test('selects exact-case Profile and leaves both existing rows untouched', async () => {
  installAppwriteMock();
  delete require.cache[require.resolve('../index.js')];
  const handler = require('../index.js');
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson: {}
    },
    res,
    log() {},
    error() {}
  });

  assert.equal(res.statusCode, 200);
  assert.ok(requests.some(item => item.path.startsWith('/v1/tablesdb/6aedcd650007f44a070f/')), 'must use the existing FUNBDATAID database ID');
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.profile.points, 17);
  assert.equal(res.payload.profile.referralCode, 'FB12345678');
  assert.equal(res.payload.profile.totalReferrals, 2);
  assert.equal(res.payload.rewardsEnabled, false);
  assert.equal(writes.length, 0, 'profile lookup must not write to either matching row');
  assert.ok(requests.some(item => item.path.endsWith('/tables/canonical-upper-id/rows')));
  assert.ok(requests.some(item => item.path.endsWith('/tables/legacy-lower-id/rows')));
});

test('fails closed when table discovery is unavailable and no configured mapping is verified', async () => {
  installAppwriteMock({ discoveryDenied: true });
  delete require.cache[require.resolve('../index.js')];
  const handler = require('../index.js');
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson: {}
    },
    res,
    log() {},
    error() {}
  });

  assert.equal(res.statusCode, 500);
  assert.match(res.payload.message, /No supplied FundB table mapping was reachable/);
  assert.equal(writes.length, 0, 'ambiguous profile lookup must never mutate user data');
});



test('does not create a new profile in a legacy candidate when exact table discovery is denied', async () => {
  installAppwriteMock({ discoveryDenied: true, legacyFallbackReachable: true });
  delete require.cache[require.resolve('../index.js')];
  const handler = require('../index.js');
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson: {}
    },
    res,
    log() {},
    error() {}
  });

  assert.equal(res.statusCode, 500);
  assert.match(res.payload.message, /exact Profile table could not be verified/);
  assert.equal(writes.length, 0, 'a reachable legacy table must never receive a new profile write');
  const fallbackReads = requests.filter(item => item.path.endsWith('/tables/6afea0720025daaed040/rows') && item.method === 'GET');
  assert.equal(fallbackReads.length, 1, 'legacy fallback may be checked only once for the existing profile; it must not be used for referral-code allocation');
});

test('legacy fallback may read an existing profile but must not change referral relationships', async () => {
  installAppwriteMock({ discoveryDenied: true, legacyFallbackReachable: true, legacyFallbackProfile: legacyProfile });
  delete require.cache[require.resolve('../index.js')];
  const handler = require('../index.js');
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin: 'https://fundb-production-hardening.fundb-mining-website.pages.dev',
        'x-appwrite-user-jwt': 'test-jwt',
        'x-appwrite-key': 'test-function-key'
      },
      bodyJson: { referralCode: 'FB12345678' }
    },
    res,
    log() {},
    error() {}
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.profile.points, 999);
  assert.equal(res.payload.rewardsEnabled, false);
  assert.equal(writes.length, 0, 'legacy fallback profile reads must not attach referrals or update counters');
  const referralReads = requests.filter(item => item.path.endsWith('/tables/6afea0720025daaed040/rows') && item.search.includes('referralCode'));
  assert.equal(referralReads.length, 0, 'referral lookup must wait for exact Profile table discovery');
});

test.after(() => {
  https.request = originalRequest;
  if (originalProjectId === undefined) delete process.env.APPWRITE_FUNCTION_PROJECT_ID;
  else process.env.APPWRITE_FUNCTION_PROJECT_ID = originalProjectId;
  if (originalEndpoint === undefined) delete process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  else process.env.APPWRITE_FUNCTION_API_ENDPOINT = originalEndpoint;
  if (originalDatabaseId === undefined) delete process.env.FUNDB_DATABASE_ID;
  else process.env.FUNDB_DATABASE_ID = originalDatabaseId;
  if (originalLegacyDatabaseId === undefined) delete process.env.FUNBDATAID;
  else process.env.FUNBDATAID = originalLegacyDatabaseId;
});
