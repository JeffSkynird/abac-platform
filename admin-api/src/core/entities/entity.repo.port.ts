export interface EntityRepoPort {
  list(tenantId: string, type: 'principal'|'resource', limit: number, offset: number): Promise<any[]>;
  upsertEntity(tenantId: string, type: 'principal'|'resource', cedarUid: string, attrs: any): Promise<any>;
  upsertAttribute(tenantId: string, entityType: 'principal'|'resource', entityUid: string, key: string, value: any): Promise<any>;
  listAttributes(tenantId: string, entityType: 'principal'|'resource', entityUid: string | undefined, limit: number, offset: number): Promise<any[]>;
}
