export class ReviewChannelQuotaCommand {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    /** The day being closed, in the account timezone (YYYY-MM-DD). */
    public readonly date: string,
  ) {}
}
