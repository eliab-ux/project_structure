export class ChangeDailyCeilingCommand {
  constructor(
    public readonly accountId: string,
    public readonly dailySendCeiling: number,
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}
