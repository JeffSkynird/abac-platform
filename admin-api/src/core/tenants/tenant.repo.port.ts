export interface TenantRepoPort {
  create(name: string, status?: 'active'|'disabled'): Promise<any>;
  list(limit: number, offset: number): Promise<any[]>;
}
