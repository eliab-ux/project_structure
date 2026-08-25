export class ConfirmDistributionCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly distributionId: string,
    /**
     * The hash the operator saw in the preview.
     *
     * Optional, but when present it is enforced: between seeing the preview and clicking confirm the
     * content can be edited, which invalidates its approval and changes the hash (§8.5). Confirming
     * then would send text nobody approved.
     */
    public readonly expectedContentHash: string | null,
    public readonly ip: string | null,
  ) {}
}
