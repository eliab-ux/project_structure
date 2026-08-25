export class RecordVisitCommand {
  constructor(
    public readonly resellerId: string,
    public readonly visitorId?: string | null,
    public readonly ipAddress?: string | null,
    public readonly userAgent?: string | null,
    public readonly referrer?: string | null,
    public readonly pageUrl?: string | null,
  ) {}
}
