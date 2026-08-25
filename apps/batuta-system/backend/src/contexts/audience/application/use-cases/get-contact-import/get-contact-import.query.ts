export class GetContactImportQuery {
  constructor(
    public readonly accountId: string,
    public readonly importId: string,
  ) {}
}
