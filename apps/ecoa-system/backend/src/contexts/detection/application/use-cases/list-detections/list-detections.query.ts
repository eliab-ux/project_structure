export class ListDetectionsQuery {
  constructor(
    public readonly ownerId: string,
    public readonly page: number,
    public readonly limit: number,
    public readonly watchlistOnly?: boolean,
    public readonly from?: Date,
    public readonly to?: Date,
    public readonly seen?: boolean,
  ) {}
}
