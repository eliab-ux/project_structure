export class ResetPasswordCommand {
  constructor(
    public readonly accessToken: string,
    public readonly newPassword: string,
  ) {}
}
