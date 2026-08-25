export class SendReplyCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly conversationId: string,
    /**
     * The final text, as the operator left it.
     *
     * A quick reply is inserted into the box and EDITED before sending (§10.3 item 3), so what arrives
     * here is always the human's version — the template id below is only for usage counting.
     */
    public readonly body: string,
    public readonly quickReplyId: string | null,
    /** "Answer and close": the common case, saved as one action instead of two. */
    public readonly resolve: boolean,
    public readonly ip: string | null,
  ) {}
}
