export class SaveQuickReplyCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    /** Null creates, present updates. */
    public readonly quickReplyId: string | null,
    public readonly title: string | undefined,
    public readonly body: string | undefined,
    public readonly tags: readonly string[] | undefined,
    public readonly ip: string | null,
  ) {}
}

export class ListQuickRepliesQuery {
  constructor(
    public readonly accountId: string,
    public readonly search?: string,
  ) {}
}

export class DeleteQuickReplyCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly quickReplyId: string,
    public readonly ip: string | null,
  ) {}
}
