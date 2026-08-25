export interface CaptureInsightsMedia {
  ownMediaId: string;
  igMediaId: string;
}

export class CaptureInsightsCommand {
  constructor(
    public readonly ownerId: string,
    public readonly accessToken: string,
    public readonly media: CaptureInsightsMedia[],
  ) {}
}
