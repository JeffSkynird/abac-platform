import { getFreshToken } from './auth';

const BASE = import.meta.env.PUBLIC_ADMIN_API_BASE;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getFreshToken();
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.status === 204 ? (undefined as T) : await res.json();
}

export const api = {
  // Tenants
  listTenants: (page = 1, limit = 50) => request(`/api/tenants?page=${page}&limit=${limit}`),
  createTenant: (name: string) => request('/api/tenants', { method: 'POST', body: JSON.stringify({ name }) }),

  // Policy Sets
  createPolicySet: (tenantId: string) => request('/api/policy-sets', { method: 'POST', body: JSON.stringify({ tenantId }) }),
  listPolicySets: (tenantId: string) => request(`/api/policy-sets?tenantId=${tenantId}`),
  addPolicy: (policySetId: string, cedar: string) => request('/api/policies', { method: 'POST', body: JSON.stringify({ policySetId, cedar }) }),
  validatePostDraft: (id: string) => request(`/api/policy-sets/${id}/validate`, { method: 'POST' }),
  testDraft: (id: string, payload: unknown) => request(`/api/policy-sets/${id}/test`, { method: 'POST', body: JSON.stringify(payload) }),
  promote: (id: string) => request(`/api/policy-sets/${id}/promote`, { method: 'POST' }),
  testActive: (payload: unknown) => request('/api/policy-sets/test-active', { method: 'POST', body: JSON.stringify(payload) }),

  // Entities
  upsertEntity: (payload: unknown) => request('/api/entities', { method: 'POST', body: JSON.stringify(payload) }),
  listEntities: (tenantId: string, type: 'principal'|'resource', page=1, limit=20) =>
    request(`/api/entities?tenantId=${tenantId}&type=${type}&page=${page}&limit=${limit}`),

  // Audit
  listAudit: (tenantId: string, page=1, limit=50) => request(`/api/audit?tenantId=${tenantId}&page=${page}&limit=${limit}`)
};
