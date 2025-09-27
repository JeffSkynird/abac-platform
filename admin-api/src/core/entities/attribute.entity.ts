export class Attribute {
  constructor(
    public readonly tenantId: string,
    public readonly entityType: 'principal'|'resource',
    public readonly entityUid: string,
    public readonly key: string,
    public value: unknown,
    public readonly updatedAt: Date
  ) {}
}
