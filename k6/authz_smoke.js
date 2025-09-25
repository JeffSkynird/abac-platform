import http, { setResponseCallback, expectedStatuses } from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

setResponseCallback(expectedStatuses({ min: 200, max: 399 }, 403));

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
    'http_req_failed{scenario:allow_path}': ['rate<0.01'],
    // 'http_req_failed{scenario:deny_path}': ['rate<0.5'], // opcional
    'http_req_duration{scenario:allow_path}': ['p(95)<300'],
    'http_req_duration{scenario:deny_path}': ['p(95)<300'],
    'authz_allow_ok': ['rate==1'],
    'authz_deny_ok': ['rate==1'],
  },
};

const BASE   = __ENV.BASE || 'http://localhost:8080/';
const TENANT = __ENV.TENANT_ID || '11111111-1111-1111-1111-111111111111';
const SECRET = __ENV.SECRET || 'dev-very-secret';
const ISS    = __ENV.ISS || 'https://auth.local/';
const AUD    = __ENV.AUD || 'pdp.example.local';

const allowLatency = new Trend('authz_allow_latency_ms', true);
const denyLatency  = new Trend('authz_deny_latency_ms', true);
const allowOk      = new Rate('authz_allow_ok');
const denyOk       = new Rate('authz_deny_ok');

function toB64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlString(s) {
  const b64 = encoding.b64encode(s, 'std');
  return toB64Url(b64);
}
function signHS256(data, secret) {
  const sigB64 = crypto.hmac('sha256', secret, data, 'base64');
  return toB64Url(sigB64);
}
function mintJWT({ sub, tid, res, act, iss = ISS, aud = AUD, ttlSec = 3600 }) {
  const header = { alg: 'HS256', typ: 'JWT', kid: 'dev' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss, aud, sub, tid, res, act, iat: now, exp: now + ttlSec };
  const headerPart  = b64urlString(JSON.stringify(header));
  const payloadPart = b64urlString(JSON.stringify(payload));
  const toSign = `${headerPart}.${payloadPart}`;
  const sig = signHS256(toSign, SECRET);
  return `${toSign}.${sig}`;
}

export function allowScenario() {
  const token = mintJWT({ sub: 'User::"123"', tid: TENANT, res: 'Document::"abc"', act: 'read' });
  const res = http.get(BASE, { headers: { Authorization: `Bearer ${token}` }, tags: { name: 'allow' } });
  allowLatency.add(res.timings.duration);
  const ok = check(res, {
    'ALLOW -> 200': (r) => r.status === 200,
    'ALLOW -> body has "Hello"': (r) => r.status !== 200 || String(r.body || '').includes('Hello'),
  });
  allowOk.add(ok);
  sleep(0.1);
}

export function denyScenario() {
  const token = mintJWT({ sub: 'User::"123"', tid: TENANT, res: 'Document::"nope"', act: 'read' });
  const res = http.get(BASE, { headers: { Authorization: `Bearer ${token}` }, tags: { name: 'deny' } });
  denyLatency.add(res.timings.duration);
  const ok = check(res, {
    'DENY -> 403': (r) => r.status === 403,
    'DENY -> body has decision or plain text': (r) => {
      if (r.status !== 403) return false;
      try { const j = JSON.parse(r.body); return !!j.decision; }
      catch { return typeof r.body === 'string'; }
    },
  });
  denyOk.add(ok);
  sleep(0.1);
}
