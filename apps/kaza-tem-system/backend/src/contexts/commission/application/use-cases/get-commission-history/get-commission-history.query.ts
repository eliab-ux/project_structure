export class GetCommissionHistoryQuery {
  constructor(
    public readonly resellerId: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
