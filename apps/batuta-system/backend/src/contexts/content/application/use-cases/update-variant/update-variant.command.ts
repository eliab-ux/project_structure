export class UpdateVariantCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    public readonly variantId: string,
    public readonly body?: string,
    /** Marks the wording as reviewed by a human (7 item 5). Never automatic. */
    public readonly markReviewed?: boolean,
    public readonly ip?: string | null,
  ) {}
}
