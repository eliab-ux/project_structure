export class UpdateQuotaBandCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly channelId: string,
    /** The operator owns floor and ceiling only. current_quota belongs to the job. */
    public readonly quotaFloor: number,
    public readonly quotaCeiling: number,
    public readonly ip: string | null,
  ) {}
}
