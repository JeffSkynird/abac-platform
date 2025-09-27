import { DataSource, QueryRunner } from 'typeorm';
import { TenantOrm } from '../../db/entities/tenant.orm';

export class TenantRepo {
  constructor(private ds: DataSource) {}
  private repo(qr: QueryRunner) { return qr.manager.getRepository(TenantOrm); }

  async create(qr: QueryRunner, name: string, status: 'active'|'disabled'='active') {
    const t = this.repo(qr).create({ name, status });
    return this.repo(qr).save(t);
  }

  async list(qr: QueryRunner, limit=20, offset=0) {
    return this.repo(qr).find({
      order: { created_at: 'DESC' as any },
      take: limit,
      skip: offset
    });
  }
}
