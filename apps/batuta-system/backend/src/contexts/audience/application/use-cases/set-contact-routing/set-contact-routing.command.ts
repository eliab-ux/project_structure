export class DeactivateContactCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contactId: string,
    public readonly ip: string | null,
  ) {}
}

export class ReactivateContactCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contactId: string,
    public readonly ip: string | null,
  ) {}
}
