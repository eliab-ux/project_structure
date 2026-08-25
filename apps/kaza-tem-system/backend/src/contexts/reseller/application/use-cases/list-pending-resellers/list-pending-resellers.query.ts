export class ListPendingResellersQuery {
  constructor(
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
