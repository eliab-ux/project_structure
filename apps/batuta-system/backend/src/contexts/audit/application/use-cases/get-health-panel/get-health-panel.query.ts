export class GetHealthPanelQuery {
  constructor(
    public readonly accountId: string,
    /** Days of history. Bounded by the use case — an unbounded window would scan every counter row. */
    public readonly windowDays?: number,
  ) {}
}
