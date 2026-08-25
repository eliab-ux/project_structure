export class UpdateContentCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly title?: string,
    public readonly bodyBase?: string,
    public readonly sourceUrl?: string | null,
    public readonly includeSourceUrl?: boolean,
    public readonly ip?: string | null,
  ) {}
}
