export class ReactivateResellerCommand {
  constructor(
    public readonly resellerId: string,
    public readonly adminId: string,
  ) {}
}
