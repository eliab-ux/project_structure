export class GetChannelHealthQuery {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly days: number = 14,
  ) {}
}
