import { EntityRepoPort } from './entity.repo.port';

export class EntityService {
  constructor(private repo: EntityRepoPort) {}

  async list(tenantId: string, type: 'principal'|'resource', page=1, limit=20) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(200, limit));
    const items = await this.repo.list(tenantId, type, l, (p-1)*l);
    return { items, page: p, limit: l };
  }

  upsert(tenantId: string, type: 'principal'|'resource', cedarUid: string, attrs: any) {
    return this.repo.upsertEntity(tenantId, type, cedarUid, attrs);
  }

  upsertAttr(tenantId: string, entityType: 'principal'|'resource', entityUid: string, key: string, value: any) {
    return this.repo.upsertAttribute(tenantId, entityType, entityUid, key, value);
  }

  async listAttrs(tenantId: string, entityType: 'principal'|'resource', entityUid?: string, page=1, limit=50) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(200, limit));
    const items = await this.repo.listAttributes(tenantId, entityType, entityUid, l, (p-1)*l);
    return { items, page: p, limit: l };
  }
}
