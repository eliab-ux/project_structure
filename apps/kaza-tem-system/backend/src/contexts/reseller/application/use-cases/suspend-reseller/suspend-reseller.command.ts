export class SuspendResellerCommand {
  constructor(
    public readonly resellerId: string,
    public readonly adminId: string,
    public readonly reason: string,
  ) {}
}
