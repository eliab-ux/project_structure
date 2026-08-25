export class ChangeUserPhoneCommand {
  constructor(
    /** From the JWT — the tenant is never taken from the request. */
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly userId: string,
    /** Raw as typed; the PhoneE164 value object normalises it. */
    public readonly phone: string,
    public readonly ip: string | null,
  ) {}
}
