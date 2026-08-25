export class ExportDistributionReportCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly distributionId: string,
    public readonly format: 'CSV' | 'PDF',
    public readonly ip: string | null,
  ) {}
}
