export interface PolicyRepoPort {
  listPolicySetsByTenant(tenantId: string): Promise<any[]>;
  createDraft(tenantId: string, baseVersion?: number): Promise<any>;
  addPolicyToDraft(policySetId: string, cedar: string): Promise<any>;
  getPoliciesByPolicySet(policySetId: string): Promise<any[]>;
  promoteDraft(policySetId: string): Promise<{ ok: true; tenantId: string; version: number }>;
}
