export class UpdateResellerProfileCommand {
  constructor(
    public readonly resellerId: string,
    public readonly fullName?: string | null,
    public readonly phone?: string | null,
  ) {}
}
