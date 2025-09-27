export class Policy {
  constructor(
    public readonly id: string,
    public readonly policySetId: string,
    public cedar: string,
    public readonly createdAt: Date
  ) {}
}
