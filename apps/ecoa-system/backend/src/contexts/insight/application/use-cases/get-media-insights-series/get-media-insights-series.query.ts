export class GetMediaInsightsSeriesQuery {
  constructor(
    public readonly ownerId: string,
    public readonly ownMediaId: string,
  ) {}
}
