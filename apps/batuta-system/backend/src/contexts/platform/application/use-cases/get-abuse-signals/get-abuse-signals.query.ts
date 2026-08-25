export class GetAbuseSignalsQuery {
  constructor(
    public readonly accountId: string,
    /** Inclusive window, ISO dates (YYYY-MM-DD). */
    public readonly from: string,
    public readonly to: string,
  ) {}
}
