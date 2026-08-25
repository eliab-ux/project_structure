export class ArchiveContentCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly ip: string | null,
  ) {}
}
