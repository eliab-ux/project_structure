export class SuspendAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly reason: string,
    /** Platform admin id, from the platform JWT. */
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}
