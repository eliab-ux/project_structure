export class RejectResellerCommand {
  constructor(
    public readonly resellerId: string,
    public readonly rejectedBy: string,
    public readonly reason: string,
  ) {}
}
