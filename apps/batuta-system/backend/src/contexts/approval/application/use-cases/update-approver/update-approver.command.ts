export class UpdateApproverCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly approverId: string,
    public readonly name?: string,
    public readonly email?: string | null,
    public readonly phone?: string | null,
    public readonly active?: boolean,
    public readonly ip?: string | null,
  ) {}
}
