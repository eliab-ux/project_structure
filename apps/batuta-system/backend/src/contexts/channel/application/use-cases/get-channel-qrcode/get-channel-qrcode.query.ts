export class GetChannelQrCodeQuery {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
  ) {}
}
