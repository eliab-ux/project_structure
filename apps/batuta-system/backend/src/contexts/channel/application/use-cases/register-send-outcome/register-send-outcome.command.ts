export class RegisterSendOutcomeCommand {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly succeeded: boolean,
  ) {}
}
