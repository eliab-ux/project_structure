export class RetireChannelCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly channelId: string,
    /** Mandatory free text: a terminal state without a recorded reason is unauditable. */
    public readonly reason: string,
    public readonly ip: string | null,
  ) {}
}
