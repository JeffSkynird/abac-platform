import { QueryRunner, DataSource } from 'typeorm';
import { PolicyRepo } from '../../infra/repos/policy.repo';
import { PdpPort } from '../pdp/pdp.port';
import { PubSubPort } from '../events/pubsub.port';

export class PolicySetService {
  constructor(
    private ds: DataSource,
    private repo: PolicyRepo,
    private pdp: PdpPort,
    private events: PubSubPort
  ) {}

  async createDraft(qr: QueryRunner, tenantId: string, baseVersion?: number) {
    return this.repo.createDraft(qr, tenantId, baseVersion);
  }

  async addPolicy(qr: QueryRunner, policySetId: string, cedar: string) {
    return this.repo.addPolicyToDraft(qr, policySetId, cedar);
  }

  async listPolicies(qr: QueryRunner, policySetId: string) {
    return this.repo.getPoliciesByPolicySet(qr, policySetId);
  }

  async updatePolicy(qr: QueryRunner, policyId: string, cedar: string, policySetId?: string) {
    return this.repo.updatePolicyInDraft(qr, policyId, cedar, policySetId);
  }

  async deletePolicy(qr: QueryRunner, policyId: string, policySetId?: string) {
    return this.repo.deletePolicyFromDraft(qr, policyId, policySetId);
  }

  async validatePreDraft(policies: string[]) {
    return this.pdp.validate({ policies });
  }

  async validatePostDraft(qr: QueryRunner, policySetId: string) {
    const policies = await this.repo.getPoliciesByPolicySet(qr, policySetId);
    const cedarArr = policies.map(p => p.cedar);
    return this.pdp.validate({ policies: cedarArr });
  }

  async testDraft(qr: QueryRunner, policySetId: string, payload: { principal:any; resource:any; action:string; context?:any }) {
    const policies = await this.repo.getPoliciesByPolicySet(qr, policySetId);
    const cedarArr = policies.map(p => p.cedar);

    const actionObj = typeof payload.action === 'string'
    ? { type: 'Action', id: payload.action }
    : payload.action;

    console.log("TEST DRAFT");
    console.log(cedarArr);
    return this.pdp.testDraft({
      policies_override: cedarArr,
      principal: payload.principal,
      resource: payload.resource,
      action: actionObj,
      context: payload.context
    });
  }

  async testPreDraft(policies: string[], payload: { principal:any; resource:any; action:string | { type: string; id: string }; context?:any }) {
    const actionObj = typeof payload.action === 'string'
    ? { type: 'Action', id: payload.action }
    : payload.action;

    console.log("TEST PRE DRAFT");
    console.log(policies);
    return this.pdp.testDraft({
      policies_override: policies,
      principal: payload.principal,
      resource: payload.resource,
      action: actionObj,
      context: payload.context
    });
  }

  async testActive(_qr: QueryRunner, tenantId: string, payload: { principal:any; resource:any; action:string; context?:any }) {
    const actionObj = typeof payload.action === 'string'
    ? { type: 'Action', id: payload.action }
    : payload.action;

    return this.pdp.testActive({
      tenant_id: tenantId,
      principal: payload.principal,
      resource: payload.resource,
      action: actionObj,
      context: payload.context
    });
  }

  async promote(qr: QueryRunner, policySetId: string) {
    const res = await this.repo.promoteDraft(qr, policySetId);
    await this.events.publishInvalidate(res.tenantId);
    return res;
  }
}
