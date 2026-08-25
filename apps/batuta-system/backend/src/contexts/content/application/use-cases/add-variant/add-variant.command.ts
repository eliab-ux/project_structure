export class AddVariantCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly label: string,
    public readonly body: string,
    public readonly ip: string | null,
  ) {}
}
