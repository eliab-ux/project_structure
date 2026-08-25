export class RequestPasswordResetCommand {
  constructor(
    public readonly email: string,
    public readonly ip: string | null,
  ) {}
}
