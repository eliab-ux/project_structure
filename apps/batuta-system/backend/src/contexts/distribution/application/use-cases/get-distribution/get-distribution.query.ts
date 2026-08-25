export class GetDistributionQuery {
  constructor(
    public readonly accountId: string,
    public readonly distributionId: string,
  ) {}
}
