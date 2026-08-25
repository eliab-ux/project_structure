export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    /** Client IP for the audit trail. Never used for authorization. */
    public readonly ip: string | null,
  ) {}
}
