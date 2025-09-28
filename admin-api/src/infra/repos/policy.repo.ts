import { DataSource, QueryRunner } from 'typeorm';
import { PolicySetOrm } from '../../db/entities/policy-set.orm';
import { PolicyOrm } from '../../db/entities/policy.orm';

export class PolicyRepo {
  constructor(private ds: DataSource) {}

  private repoPS(qr: QueryRunner) { return qr.manager.getRepository(PolicySetOrm); }
  private repoP(qr: QueryRunner) { return qr.manager.getRepository(PolicyOrm); }

  async listPolicySetsByTenant(qr: QueryRunner, tenantId: string) {
    return this.repoPS(qr).find({ where: { tenant_id: tenantId }, order: { version: 'DESC' } });
  }

  async createDraft(qr: QueryRunner, tenantId: string, baseVersion?: number) {
    let version = 1;
    if (baseVersion) version = baseVersion;
    else {
      const row = await qr.query(
        `SELECT COALESCE(MAX(version),0)+1 AS v FROM policy_sets WHERE tenant_id = $1`, [tenantId]
      );
      version = Number(row[0].v);
    }
    const ps = this.repoPS(qr).create({ tenant_id: tenantId, version, status: 'draft' as any });
    await this.repoPS(qr).save(ps);

    if (baseVersion) {
      const src = await this.repoPS(qr).findOne({ where: { tenant_id: tenantId, version: baseVersion } });
      if (!src) throw new Error('baseVersion not found');
      const policies = await this.repoP(qr).find({ where: { policy_set_id: src.id } });
      for (const p of policies) {
        const np = this.repoP(qr).create({ policy_set_id: ps.id, cedar: p.cedar });
        await this.repoP(qr).save(np);
      }
    }
    return ps;
  }

  async addPolicyToDraft(qr: QueryRunner, policySetId: string, cedar: string) {
    const ps = await this.repoPS(qr).findOne({ where: { id: policySetId } });
    if (!ps) throw new Error('policy set not found');
    if (ps.status !== 'draft') throw new Error('policy set is not draft');
    const p = this.repoP(qr).create({ policy_set_id: policySetId, cedar });
    return this.repoP(qr).save(p);
  }

  async updatePolicyInDraft(qr: QueryRunner, policyId: string, cedar: string, policySetId?: string) {
    const policy = await this.repoP(qr).findOne({ where: { id: policyId } });
    if (!policy) throw new Error('policy not found');
    if (policySetId && policy.policy_set_id !== policySetId) {
      throw new Error('policy does not belong to policy set');
    }

    const ps = await this.repoPS(qr).findOne({ where: { id: policy.policy_set_id } });
    if (!ps) throw new Error('policy set not found');
    if (ps.status !== 'draft') throw new Error('policy set is not draft');

    policy.cedar = cedar;
    return this.repoP(qr).save(policy);
  }

  async deletePolicyFromDraft(qr: QueryRunner, policyId: string, policySetId?: string) {
    const policy = await this.repoP(qr).findOne({ where: { id: policyId } });
    if (!policy) throw new Error('policy not found');
    if (policySetId && policy.policy_set_id !== policySetId) {
      throw new Error('policy does not belong to policy set');
    }

    const ps = await this.repoPS(qr).findOne({ where: { id: policy.policy_set_id } });
    if (!ps) throw new Error('policy set not found');
    if (ps.status !== 'draft') throw new Error('policy set is not draft');

    await this.repoP(qr).delete(policyId);
    return { ok: true };
  }

  async getPoliciesByPolicySet(qr: QueryRunner, policySetId: string) {
    return this.repoP(qr).find({ where: { policy_set_id: policySetId }, order: { created_at: 'ASC' } });
  }

  async promoteDraft(qr: QueryRunner, policySetId: string) {
    const ps = await this.repoPS(qr).findOne({ where: { id: policySetId } });
    if (!ps) throw new Error('policy set not found');
    if (ps.status !== 'draft') throw new Error('not a draft');
    await qr.query(`UPDATE policy_sets SET status='active' WHERE id=$1`, [policySetId]);
    return { ok: true, tenantId: ps.tenant_id, version: ps.version };
  }
}
