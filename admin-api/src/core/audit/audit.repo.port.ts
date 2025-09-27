export interface AuditRepoPort {
  list(tenantId: string, limit: number, offset: number): Promise<any[]>;
  writePromotion?(tenantId: string, version: number): Promise<void>;
}
