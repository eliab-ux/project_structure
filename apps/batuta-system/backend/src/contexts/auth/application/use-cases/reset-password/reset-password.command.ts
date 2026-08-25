export class ResetPasswordCommand {
  constructor(
    /** Identifies WHO is resetting. Six digits alone are not an identifier. */
    public readonly email: string,
    public readonly code: string,
    public readonly newPassword: string,
    public readonly ip: string | null,
  ) {}
}
