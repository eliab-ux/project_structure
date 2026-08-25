export class DisableUserCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly userId: string,
    public readonly ip: string | null,
  ) {}
}
