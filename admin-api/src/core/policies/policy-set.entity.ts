export class PolicySet {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly version: number,
    public status: 'active'|'draft',
    public readonly createdAt: Date
  ) {}
}
