export class Principal {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly cedarUid: string,
    public attrs: Record<string, unknown>,
    public readonly createdAt: Date
  ) {}
}
