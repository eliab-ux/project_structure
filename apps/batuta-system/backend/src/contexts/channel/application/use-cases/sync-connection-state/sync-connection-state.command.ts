export class SyncConnectionStateCommand {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
  ) {}
}
