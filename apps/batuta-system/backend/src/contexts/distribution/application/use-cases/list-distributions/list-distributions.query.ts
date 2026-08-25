import { DistributionStatus } from '../../../domain/value-objects/distribution-status.vo';

export class ListDistributionsQuery {
  constructor(
    public readonly accountId: string,
    public readonly page?: number,
    public readonly limit?: number,
    public readonly status?: DistributionStatus,
    public readonly contentId?: string,
  ) {}
}
