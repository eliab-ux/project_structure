export class CreateAccountCommand {
  constructor(
    public readonly name: string,
    public readonly document: string,
    public readonly plan: string,
    public readonly dailySendCeiling: number,
    public readonly timezone: string,
    /** First ACCOUNT_ADMIN of the new tenant — a tenant with no way in is useless. */
    public readonly adminName: string,
    public readonly adminEmail: string,
    /**
     * WhatsApp of the first admin — required (CLAUDE.md regra 9). This is the one user nobody else
     * in the tenant can help: without a number, a forgotten password means losing the account.
     */
    public readonly adminPhone: string,
    public readonly adminPassword: string,
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}
