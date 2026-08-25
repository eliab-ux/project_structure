export class PlatformLoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ip: string | null,
  ) {}
}
