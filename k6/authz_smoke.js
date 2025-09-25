import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const options = {
  scenarios: {
    allow_path: {
      executor: 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
      duration: __ENV.DURATION || '20s',
      exec: 'allowScenario',
    },
    deny_path: {
      executor: 'constant-vus',
      vus: __ENV.VUS_DENY ? parseInt(__ENV.VUS_DENY) : 5,
      duration: __ENV.DURATION_DENY || '20s',
      exec: 'denyScenario',
      startTime: '3s',
    },
  },
  thresholds: {
    'http_req_failed{expected_response:true}': ['rate<0.01'],
    'http_req_duration{expected_response:true}': ['p(95)<300'],
    'authz_deny_ok': ['rate==1'],
    'authz_allow_ok': ['rate==1'],
  },
};

const BASE = __ENV.BASE || 'http://localhost:8080/';
const TENANT = __ENV.TENANT_ID || '11111111-1111-1111-1111-111111111111';

// cusom metrics (optional)
const allowLatency = new Trend('authz_allow_latency_ms', true);
const denyLatency = new Trend('authz_deny_latency_ms', true);
const allowOk = new Rate('authz_allow_ok');
const denyOk = new Rate('authz_deny_ok');

export function allowScenario() {
  const headers = {
    'x-tenant-id': TENANT,
    'x-principal': 'User::"123"',
    'x-resource':  'Document::"abc"',
    'x-action':    'read',
  };

  const res = http.get(BASE, { headers, tags: { path: 'allow' } });
  allowLatency.add(res.timings.duration);

  const ok = check(res, {
    'ALLOW -> status 200': (r) => r.status === 200,
    // optional: validates the expected body
    'ALLOW -> body contiene hello': (r) => r.status !== 200 || String(r.body || '').includes('Hello'),
  });
  allowOk.add(ok);

  sleep(0.1);
}

export function denyScenario() {
  const headers = {
    'x-tenant-id': TENANT,
    'x-principal': 'User::"123"',
    'x-resource':  'Document::"nope"', // resource without policy -> DENY
    'x-action':    'read',
  };

  const res = http.get(BASE, { headers, tags: { path: 'deny' } });
  denyLatency.add(res.timings.duration);

  const ok = check(res, {
    'DENY -> status 403': (r) => r.status === 403,
    // Validates the structure of the PDP JSON that receive via Envoy
    'DENY -> decision JSON': (r) => {
      if (r.status !== 403) return false;
      try {
        const j = JSON.parse(r.body);
        return j.decision && (j.decision === 'DENY' || j.decision === 'ALLOW');
      } catch (_) {
        return false;
      }
    },
  });
  denyOk.add(ok);

  sleep(0.1);
}
