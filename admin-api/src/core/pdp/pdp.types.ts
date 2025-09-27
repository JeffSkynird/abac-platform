export type ActionInput = string | { type: string; id: string };
export type ValidateReq = { policies: string[] };
export type ValidateRes = { ok: boolean; errors: string[] };

export type TestOverrideReq = {
  policies_override: string[];
  principal: any; resource: any;  action: ActionInput;  context?: any;
};
export type TestActiveReq = {
  tenant_id: string;
  principal: any; resource: any; action: ActionInput; context?: any;
};
export type TestRes = { decision: 'ALLOW'|'DENY'; reason: string };
