import { TenantRepoPort } from './tenant.repo.port';

export class TenantService {
  constructor(private repo: TenantRepoPort) {}

  create(name: string, status: 'active'|'disabled'='active') {
    return this.repo.create(name, status);
  }

  async list(page=1, limit=20) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(200, limit));
    const items = await this.repo.list(l, (p-1)*l);
    return { items, page: p, limit: l };
  }
}
