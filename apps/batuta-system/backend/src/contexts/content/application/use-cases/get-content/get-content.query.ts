export class GetContentQuery {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
  ) {}
}
