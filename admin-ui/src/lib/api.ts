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
  listPolicies: (policySetId: string) => request(`/api/policies?policySetId=${policySetId}`),
  addPolicy: (policySetId: string, cedar: string) =>
    request('/api/policies', { method: 'POST', body: JSON.stringify({ policySetId, cedar }) }),
  updatePolicy: (policySetId: string, policyId: string, cedar: string) =>
    request('/api/policies', {
      method: 'PUT',
      body: JSON.stringify({ policySetId, policyId, cedar }),
    }),
  deletePolicy: (policySetId: string, policyId: string) =>
    request(`/api/policies/${policyId}?policySetId=${policySetId}`, { method: 'DELETE' }),
  preValidatePolicies: (policies: string[]) => request('/api/policy-sets/pre-validate', { method: 'POST', body: JSON.stringify({ policies }) }),
  validatePostDraft: (id: string) => request(`/api/policy-sets/${id}/validate`, { method: 'POST' }),
  testDraft: (id: string, payload: unknown) => request(`/api/policy-sets/${id}/test`, { method: 'POST', body: JSON.stringify(payload) }),
  preTestDraft: (id: string, payload: unknown) => request(`/api/policy-sets/${id}/pre-test`, { method: 'POST', body: JSON.stringify(payload) }),
  promote: (id: string) => request(`/api/policy-sets/${id}/promote`, { method: 'POST' }),
  testActive: (payload: unknown) => request('/api/policy-sets/test-active', { method: 'POST', body: JSON.stringify(payload) }),

  // Entities
  upsertEntity: (payload: { tenantId: string; type: 'principal' | 'resource'; cedar_uid: string; attrs: unknown }) =>
    request('/api/entities', { method: 'POST', body: JSON.stringify(payload) }),
  updateEntity: (
    tenantId: string,
    type: 'principal' | 'resource',
    entityId: string,
    payload: { cedar_uid: string; attrs: unknown }
  ) =>
    request(`/api/entities/${type}/${entityId}?tenantId=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteEntity: (tenantId: string, type: 'principal' | 'resource', entityId: string) =>
    request(`/api/entities/${type}/${entityId}?tenantId=${tenantId}`, { method: 'DELETE' }),
  listEntities: (tenantId: string, type: 'principal' | 'resource', page = 1, limit = 20) =>
    request(`/api/entities?tenantId=${tenantId}&type=${type}&page=${page}&limit=${limit}`),

  // Audit
  listAudit: (
    tenantId: string,
    options?:
      | number
      | {
          page?: number;
          limit?: number;
          from?: string;
          to?: string;
        },
    legacyLimit?: number
  ) => {
    let page = 1;
    let limit = 50;
    let from: string | undefined;
    let to: string | undefined;

    if (typeof options === 'number') {
      page = options;
      if (typeof legacyLimit === 'number') {
        limit = legacyLimit;
      }
    } else if (options) {
      page = options.page ?? page;
      limit = options.limit ?? limit;
      from = options.from;
      to = options.to;
    }

    const params = new URLSearchParams({
      tenantId,
      page: String(page),
      limit: String(limit),
    });

    if (from) params.set('from', from);
    if (to) params.set('to', to);

    return request(`/api/audit?${params.toString()}`);
  },
};
