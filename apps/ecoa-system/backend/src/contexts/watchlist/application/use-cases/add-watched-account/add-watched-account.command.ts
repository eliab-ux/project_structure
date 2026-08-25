export class AddWatchedAccountCommand {
  constructor(
    public readonly ownerId: string,
    public readonly handle: string,
  ) {}
}
