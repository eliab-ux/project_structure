export class ResolveWatchlistCommand {
  constructor(
    public readonly ownerId: string,
    public readonly accessToken: string,
  ) {}
}
