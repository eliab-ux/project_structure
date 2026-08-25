export class DistributionControlCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly distributionId: string,
    /** Only used by cancel; pause and resume pass null. */
    public readonly reason: string | null,
    public readonly ip: string | null,
  ) {}
}
