export class ListOrdersQuery {
  constructor(
    public readonly status?: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
