export class DeleteContactCommand {
  constructor(
    public readonly accountId: string,
    public readonly contactId: string,
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}
