export class SyncOwnMediaCommand {
  constructor(
    public readonly ownerId: string,
    public readonly igUserId: string,
    public readonly accessToken: string,
    public readonly limit?: number,
  ) {}
}
