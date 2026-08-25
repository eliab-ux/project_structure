export class OptOutContactCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contactId: string,
    public readonly ip: string | null,
  ) {}
}
