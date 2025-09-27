import { AuditRepoPort } from './audit.repo.port';

export class AuditService {
  constructor(private repo: AuditRepoPort) {}
  async list(tenantId: string, page = 1, limit = 50) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(200, limit));
    const items = await this.repo.list(tenantId, l, (p - 1) * l);
    return { items, page: p, limit: l };
  }
}
