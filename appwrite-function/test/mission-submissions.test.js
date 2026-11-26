const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const originalRequest = https.request;
const envNames = [
  'APPWRITE_FUNCTION_PROJECT_ID',
  'APPWRITE_FUNCTION_API_ENDPOINT',
  'FUNDB_DATABASE_ID',
  'FUNDB_MISSION_SUBMISSIONS_TABLE_ID',
  'FUNDB_ADMIN_USER_IDS'
];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

for (const [name, value] of Object.entries({
  APPWRITE_FUNCTION_PROJECT_ID: 'fundb-ci-test-project',
  APPWRITE_FUNCTION_API_ENDPOINT: 'https://nyc.cloud.appwrite.io/v1',
  FUNDB_DATABASE_ID: 'fundB_database',
  FUNDB_MISSION_SUBMISSIONS_TABLE_ID: 'fundb_mission_submissions',
  FUNDB_ADMIN_USER_IDS: 'verified-admin-42'
})) process.env[name] = value;

const verifiedUser = { $id: 'verified-user-42' };
const adminUser = { $id: 'verified-admin-42' };
const origin = 'https://fundb-production-hardening.fundb-mining-website.pages.dev';

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

function installMock({ account = verifiedUser, rows = [], postStatus = 201 } = {}) {
  const calls = [];
  let createdRow = null;
  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    let body = '';
    request.write = chunk => { body += chunk; };
    request.destroy = err => request.emit('error', err);
    request.end = () => {
      const parsed = new URL(url);
      const call = {
        path: parsed.pathname,
        search: parsed.search,
        method: options.method,
        headers: options.headers,
        body: body ? JSON.parse(body) : null
      };
      calls.push(call);
      let statusCode = 200;
      let payload = {};
      if (call.path === '/v1/account' && call.method === 'GET') {
        payload = account;
      } else if (call.path.endsWith('/tables/fundb_mission_submissions/rows') && call.method === 'POST') {
        if (postStatus === 409) {
          statusCode = 409;
          payload = { message: 'Row already exists', type: 'row_already_exists' };
        } else {
          createdRow = {
            $id: call.body.rowId,
            ...call.body.data
          };
          statusCode = postStatus;
          payload = createdRow;
        }
      } else if (/\/tables\/fundb_mission_submissions\/rows\/[A-Za-z0-9_-]+$/.test(call.path) && call.method === 'GET') {
        payload = createdRow || rows[0] || {
          $id: call.path.split('/').pop(),
          userId: verifiedUser.$id,
          missionId: 'digital-safety-checklist',
          status: 'pending',
          submittedAt: '2026-11-22T00:00:00.000Z'
        };
      } else if (call.path.endsWith('/tables/fundb_mission_submissions/rows') && call.method === 'GET') {
        payload = { rows, total: rows.length };
      } else if (/\/tables\/fundb_mission_submissions\/rows\/[A-Za-z0-9_-]+$/.test(call.path) && call.method === 'PATCH') {
        payload = { ...(createdRow || rows[0] || {}), ...(call.body.data || {}) };
      } else {
        statusCode = 404;
        payload = { message: 'Unexpected mock route: ' + call.method + ' ' + call.path, type: 'not_found' };
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

function loadHandler() {
  delete require.cache[require.resolve('../index.js')];
  return require('../index.js');
}

async function invoke(handler, account, bodyJson) {
  const res = makeResponse();
  await handler({
    req: {
      method: 'POST',
      headers: {
        origin,
        'x-appwrite-user-jwt': 'test-user-jwt',
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

test('submission derives ownership and reward fields from verified server values, not browser JSON', async () => {
  const calls = installMock();
  const res = await invoke(loadHandler(), verifiedUser, {
    action: 'submitMission',
    missionId: 'digital-safety-checklist',
    evidence: 'https://example.com/proof',
    userId: 'attacker-user',
    status: 'approved',
    reviewer: 'attacker-admin',
    approvedPoints: 70,
    reviewedAt: '2026-11-21T00:00:00.000Z'
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.submission.status, 'pending');
  assert.equal(res.payload.rewardsEnabled, false);
  const create = calls.find(call => call.method === 'POST');
  assert.ok(create);
  assert.match(create.body.rowId, /^[a-f0-9]{32}$/);
  assert.equal(create.body.data.userId, verifiedUser.$id);
  assert.equal(create.body.data.status, 'pending');
  assert.equal(create.body.data.approvedPoints, 0);
  assert.equal(create.body.data.reviewer, '');
  assert.equal(create.body.data.evidence, 'https://example.com/proof');
  assert.equal(Object.hasOwn(create.body.data, 'reviewedAt'), false);
});

test('duplicate submission retries return the existing deterministic row without creating a second row', async () => {
  const calls = installMock({ postStatus: 409 });
  const res = await invoke(loadHandler(), verifiedUser, {
    action: 'submitMission',
    missionId: 'digital-safety-checklist',
    evidence: 'proof'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.duplicate, true);
  assert.equal(res.payload.submission.status, 'pending');
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(calls.filter(call => call.method === 'GET' && /\/rows\/[a-f0-9]{32}$/.test(call.path)).length, 1);
});

test('accepts only the five published mission IDs', async () => {
  const allowed = [
    'digital-safety-checklist',
    'community-contribution',
    'scam-awareness',
    'learning-reflection',
    'product-feedback'
  ];
  for (const missionId of allowed) {
    installMock();
    const res = await invoke(loadHandler(), verifiedUser, {
      action: 'submitMission', missionId, evidence: 'valid evidence'
    });
    assert.equal(res.statusCode, 201, missionId);
    assert.equal(res.payload.submission.missionId, missionId);
    assert.equal(res.payload.rewardsEnabled, false);
  }
});
test('invalid mission IDs and oversized or missing evidence are rejected', async () => {
  for (const input of [
    { missionId: 'bad mission', evidence: 'proof' },
    { missionId: 'rate-app', evidence: 'proof' },
    { missionId: 'digital-safety-checklist', evidence: '' },
    { missionId: 'digital-safety-checklist', evidence: 'x'.repeat(2001) }
  ]) {
    const calls = installMock();
    const res = await invoke(loadHandler(), verifiedUser, { action: 'submitMission', ...input });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.filter(call => call.method === 'POST').length, 0);
  }
});

test('personal submission history is filtered by Appwrite-verified identity', async () => {
  const rows = [{ $id: 'row-1', userId: verifiedUser.$id, missionId: 'digital-safety-checklist', status: 'pending', submittedAt: '2026-11-22T00:00:00.000Z' }];
  const calls = installMock({ rows });
  const res = await invoke(loadHandler(), verifiedUser, {
    action: 'myMissionSubmissions',
    userId: 'attacker-user'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.submissions.length, 1);
  const queryCall = calls.find(call => call.method === 'GET' && call.path.endsWith('/rows'));
  const queries = new URLSearchParams(queryCall.search).getAll('queries[]').map(value => JSON.parse(value));
  const owner = queries.find(query => query.attribute === 'userId');
  assert.deepEqual(owner.values, [verifiedUser.$id]);
});

test('non-admin cannot access the review queue or modify a submission', async () => {
  const calls = installMock({ account: verifiedUser });
  const res = await invoke(loadHandler(), verifiedUser, { action: 'adminMissionQueue' });

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'ADMIN_ONLY');
  assert.equal(calls.some(call => call.path.endsWith('/rows') && call.method === 'GET'), false);
});

test('admin queue returns only pending rows', async () => {
  const rows = [{ $id: 'row-1', userId: verifiedUser.$id, missionId: 'digital-safety-checklist', status: 'pending', submittedAt: '2026-11-22T00:00:00.000Z' }];
  const calls = installMock({ account: adminUser, rows });
  const res = await invoke(loadHandler(), adminUser, { action: 'adminMissionQueue' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.submissions.length, 1);
  const queueCall = calls.find(call => call.method === 'GET' && call.path.endsWith('/rows'));
  const queries = new URLSearchParams(queueCall.search).getAll('queries[]').map(value => JSON.parse(value));
  assert.ok(queries.some(query => query.method === 'equal' && query.attribute === 'status' && query.values[0] === 'pending'));
});

test('admin may reject with a reason, but cannot approve or assign points', async () => {
  const calls = installMock({ account: adminUser });
  const res = await invoke(loadHandler(), adminUser, {
    action: 'reviewMissionSubmission',
    submissionId: 'submission-123',
    decision: 'reject',
    rejectionReason: 'Evidence is not sufficient.'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.submission.status, 'rejected');
  const patch = calls.find(call => call.method === 'PATCH');
  assert.ok(patch);
  assert.equal(patch.body.data.status, 'rejected');
  assert.equal(patch.body.data.reviewer, adminUser.$id);
  assert.equal(patch.body.data.rejectionReason, 'Evidence is not sufficient.');
  assert.equal(Object.hasOwn(patch.body.data, 'approvedPoints'), false);

  const noApprovalCalls = installMock({ account: adminUser });
  const approval = await invoke(loadHandler(), adminUser, {
    action: 'reviewMissionSubmission',
    submissionId: 'submission-123',
    decision: 'approve',
    approvedPoints: 70
  });
  assert.equal(approval.statusCode, 400);
  assert.equal(noApprovalCalls.some(call => call.method === 'PATCH'), false);
});

test.after(() => {
  https.request = originalRequest;
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
