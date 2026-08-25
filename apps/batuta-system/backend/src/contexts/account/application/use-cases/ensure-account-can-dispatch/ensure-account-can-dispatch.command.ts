export class EnsureAccountCanDispatchCommand {
  constructor(
    public readonly accountId: string,
    /** 0 = "may this account send at all?"; > 0 = "does this many sends fit today?". */
    public readonly requestedSends: number = 0,
  ) {}
}
