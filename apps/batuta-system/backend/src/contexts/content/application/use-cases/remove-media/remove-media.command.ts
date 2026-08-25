export class RemoveMediaCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly mediaId: string,
    public readonly ip: string | null,
  ) {}
}
