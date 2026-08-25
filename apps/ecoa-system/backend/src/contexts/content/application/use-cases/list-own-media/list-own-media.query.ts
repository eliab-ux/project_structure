export class ListOwnMediaQuery {
  constructor(
    public readonly ownerId: string,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
