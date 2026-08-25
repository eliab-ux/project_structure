import { ContentClassification } from '../../../domain/value-objects/content-classification.vo';
import { ContentStatus } from '../../../domain/value-objects/content-status.vo';

export class ListContentsQuery {
  constructor(
    public readonly accountId: string,
    public readonly page: number,
    public readonly limit: number,
    public readonly status?: ContentStatus,
    public readonly classification?: ContentClassification,
    public readonly search?: string,
  ) {}
}
