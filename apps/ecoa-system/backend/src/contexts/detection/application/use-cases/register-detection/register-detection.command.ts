import { DetectionType } from '../../../domain/value-objects/detection-type.vo';

export class RegisterDetectionCommand {
  constructor(
    public readonly ownerId: string,
    public readonly sourceUsername: string,
    public readonly detectionType: DetectionType,
    public readonly ownMediaId: string | null = null,
    public readonly watchedAccountId: string | null = null,
    public readonly permalink: string | null = null,
    public readonly detectedAt?: Date,
  ) {}
}
