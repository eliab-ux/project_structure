import { Visit } from '../../domain/entities/visit.entity';

export class VisitDto {
  id!: string;
  resellerId!: string;
  visitorId?: string | null;
  createdAt!: Date;

  static fromDomain(visit: Visit): VisitDto {
    const dto = new VisitDto();
    dto.id = visit.id.value;
    dto.resellerId = visit.resellerId;
    dto.visitorId = visit.visitorId;
    dto.createdAt = visit.createdAt;
    return dto;
  }
}
