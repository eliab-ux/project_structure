export class MarkChannelBannedCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly channelId: string,
    public readonly reason: string,
    public readonly ip: string | null,
  ) {}
}
