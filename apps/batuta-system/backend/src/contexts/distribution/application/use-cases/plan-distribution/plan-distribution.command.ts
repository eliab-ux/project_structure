export class PlanDistributionCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly windowStart: Date,
    public readonly windowEnd: Date,
    public readonly tags: readonly string[],
    public readonly variantMappings: readonly { variantId: string; tag: string }[],
    /**
     * True → compute and return the preview, persist NOTHING.
     *
     * The same code path produces both the preview and the plan, deliberately: a preview computed by
     * different code than the plan is a preview of something else, and §9.3 makes it the basis of the
     * operator's decision.
     */
    public readonly dryRun: boolean,
    public readonly ip: string | null,
  ) {}
}
