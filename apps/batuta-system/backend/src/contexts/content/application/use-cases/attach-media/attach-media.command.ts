export class AttachMediaCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly contentId: string,
    /** Null → attaches to the content itself rather than to one variant. */
    public readonly variantId: string | null,
    public readonly fileName: string,
    public readonly mimeType: string,
    /** Base64 in JSON — Fastify, never multipart (CLAUDE.md, 7 item 4). */
    public readonly fileBase64: string,
    public readonly ip: string | null,
  ) {}
}
