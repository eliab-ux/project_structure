export class RemoveWatchedAccountCommand {
  constructor(
    public readonly ownerId: string,
    public readonly id: string,
  ) {}
}
