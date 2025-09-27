export class Tenant {
  constructor(
    public readonly id: string,
    public name: string,
    public status: 'active'|'disabled',
    public readonly createdAt: Date
  ) {}
}
