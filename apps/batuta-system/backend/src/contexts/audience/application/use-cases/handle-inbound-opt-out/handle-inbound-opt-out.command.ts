export class HandleInboundOptOutCommand {
  constructor(
    public readonly accountId: string,
    /** Sender of the inbound message, as it arrived from the provider. */
    public readonly fromPhone: string,
    public readonly body: string,
    public readonly channelId: string,
  ) {}
}
