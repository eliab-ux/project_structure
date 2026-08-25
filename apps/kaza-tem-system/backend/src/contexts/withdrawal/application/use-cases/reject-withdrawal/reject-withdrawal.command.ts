export class RejectWithdrawalCommand {
  constructor(
    public readonly withdrawalId: string,
    public readonly reason: string,
  ) {}
}
