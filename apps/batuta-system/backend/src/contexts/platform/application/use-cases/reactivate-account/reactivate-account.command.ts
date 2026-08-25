export class ReactivateAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}
