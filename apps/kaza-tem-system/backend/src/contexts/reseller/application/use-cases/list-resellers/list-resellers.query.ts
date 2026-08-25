export class ListResellersQuery {
  constructor(
    public readonly status?: string,
    public readonly level?: string,
    public readonly search?: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
