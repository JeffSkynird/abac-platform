import { DataSource, QueryRunner } from 'typeorm';
import { PrincipalOrm } from '../../db/entities/principal.orm';
import { ResourceOrm } from '../../db/entities/resource.orm';
import { AttributeOrm } from '../../db/entities/attribute.orm';

export class EntityRepo {
  constructor(private ds: DataSource) {}

  private principal(qr: QueryRunner) { return qr.manager.getRepository(PrincipalOrm); }
  private resource(qr: QueryRunner) { return qr.manager.getRepository(ResourceOrm); }
  private attribute(qr: QueryRunner) { return qr.manager.getRepository(AttributeOrm); }

  async list(qr: QueryRunner, tenantId: string, type: 'principal'|'resource', limit=20, offset=0) {
    if (type === 'principal') {
      return this.principal(qr).find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' as any }, take: limit, skip: offset });
    }
    return this.resource(qr).find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' as any }, take: limit, skip: offset });
  }

  async upsertEntity(qr: QueryRunner, tenantId: string, type: 'principal'|'resource', cedar_uid: string, attrs: any) {
    const table = type === 'principal' ? 'principals' : 'resources';
    const rows = await qr.query(
      `INSERT INTO ${table} (tenant_id, cedar_uid, attrs)
       VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, cedar_uid) DO UPDATE SET attrs = EXCLUDED.attrs
       RETURNING *`,
      [tenantId, cedar_uid, attrs ?? {}]
    );
    return rows[0];
  }

  async updateEntity(
    qr: QueryRunner,
    tenantId: string,
    type: 'principal'|'resource',
    id: string,
    updates: { cedar_uid?: string; attrs?: any }
  ) {
    const table = type === 'principal' ? 'principals' : 'resources';
    const setters: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.cedar_uid !== undefined) {
      setters.push(`cedar_uid = $${idx++}`);
      params.push(updates.cedar_uid);
    }

    if (updates.attrs !== undefined) {
      setters.push(`attrs = $${idx++}`);
      params.push(updates.attrs ?? {});
    }

    if (!setters.length) {
      const rows = await qr.query(
        `SELECT * FROM ${table} WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
      );
      return rows[0];
    }

    const tenantIdx = idx++;
    const idIdx = idx++;
    params.push(tenantId, id);

    const rows = await qr.query(
      `UPDATE ${table} SET ${setters.join(', ')} WHERE tenant_id = $${tenantIdx} AND id = $${idIdx} RETURNING *`,
      params
    );
    return rows[0];
  }

  async deleteEntity(
    qr: QueryRunner,
    tenantId: string,
    type: 'principal'|'resource',
    id: string
  ) {
    const table = type === 'principal' ? 'principals' : 'resources';
    const rows = await qr.query(
      `DELETE FROM ${table} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id]
    );
    return rows[0];
  }

  async upsertAttribute(qr: QueryRunner, tenantId: string, entity_type: 'principal'|'resource', entity_uid: string, key: string, value: any) {
    const rows = await qr.query(
      `INSERT INTO attributes (tenant_id, entity_type, entity_uid, key, value)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, entity_type, entity_uid, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()
       RETURNING *`,
      [tenantId, entity_type, entity_uid, key, value]
    );
    return rows[0];
  }

  async listAttributes(qr: QueryRunner, tenantId: string, entity_type: 'principal'|'resource', entity_uid?: string, limit=50, offset=0) {
    const args: any[] = [tenantId];
    let where = `tenant_id = $1 AND entity_type = '${entity_type}'`;
    if (entity_uid) {
      args.push(entity_uid);
      where += ` AND entity_uid = $${args.length}`;
    }
    const rows = await qr.query(
      `SELECT * FROM attributes WHERE ${where} ORDER BY updated_at DESC LIMIT $${args.length+1} OFFSET $${args.length+2}`,
      [...args, limit, offset]
    );
    return rows;
  }
}
