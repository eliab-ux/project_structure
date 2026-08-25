export class ExecuteDispatchCommand {
  constructor(
    /**
     * From the JOB PAYLOAD. The worker has no request and no JWT, so the tenant scope is established
     * from this value by TenantScopedJobRunner before the use case runs — and the raw claim query
     * carries it into its WHERE clause.
     */
    public readonly accountId: string,
    public readonly distributionId: string,
    public readonly dispatchId: string,
    /** The account's timezone, so "today" means the same calendar day the quota is counted in. */
    public readonly timeZone: string,
  ) {}
}
