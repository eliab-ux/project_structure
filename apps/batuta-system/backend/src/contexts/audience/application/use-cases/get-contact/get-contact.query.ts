export class GetContactQuery {
  constructor(
    public readonly accountId: string,
    public readonly contactId: string,
  ) {}
}
