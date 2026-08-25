export class DuplicateContentCommand {
  constructor(
    /** From the JWT — the tenant is never taken from the request. */
    public readonly accountId: string,
    public readonly performedBy: string,
    /** The content being copied. Must belong to this account; the tenant filter guarantees it. */
    public readonly contentId: string,
    public readonly ip: string | null,
  ) {}
}
