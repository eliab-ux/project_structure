export class GetChannelQuery {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
  ) {}
}
