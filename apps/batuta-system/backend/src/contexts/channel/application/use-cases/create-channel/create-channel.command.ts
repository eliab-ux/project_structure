export class CreateChannelCommand {
  constructor(
    /** From the JWT of the ACCOUNT_ADMIN provisioning the chip. */
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly label: string,
    public readonly phone: string,
    /** Optional: omitted means the configured default band (DECISÃO PENDENTE §14 item 1). */
    public readonly quotaFloor: number | null,
    public readonly quotaCeiling: number | null,
    public readonly ip: string | null,
  ) {}
}
