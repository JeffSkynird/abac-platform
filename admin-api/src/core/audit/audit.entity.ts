export class AuditLog {
  constructor(
    public readonly tenantId: string,
    public readonly principal: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly decision: 'ALLOW'|'DENY',
    public readonly policySetVersion: number | null,
    public readonly latencyMs: number,
    public readonly ts: Date
  ) {}
}
