export class CreateApproverCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly name: string,
    /** At least one of email/phone is required — an unreachable approver blocks submissions. */
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly ip: string | null,
  ) {}
}
