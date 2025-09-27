import { DataSource, QueryRunner } from 'typeorm';

export class AuditRepo {
  constructor(private ds: DataSource) {}

  async list(qr: QueryRunner, tenantId: string, limit=50, offset=0) {
    return qr.query(
      `SELECT tenant_id, principal, resource, action, decision, policy_set_version, latency_ms, ts
       FROM audit_logs
       WHERE tenant_id = $1
       ORDER BY ts DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );
  }

  async writePromotion(qr: QueryRunner, tenantId: string, version: number) {
    await qr.query(
      `INSERT INTO audit_logs (tenant_id, principal, resource, action, decision, policy_set_version, latency_ms, ts)
       VALUES ($1, $2, $3, $4, $5, $6, 0, now())`,
      [tenantId, 'system', 'policy_set', 'promote', 'ALLOW', version]
    );
  }
}
