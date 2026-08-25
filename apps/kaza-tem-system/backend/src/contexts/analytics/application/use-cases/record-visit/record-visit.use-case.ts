import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { VisitRepositoryPort, VISIT_REPOSITORY } from '../../ports/output/visit-repository.port';
import { RecordVisitCommand } from './record-visit.command';
import { VisitDto } from '../../dto/visit.dto';
import { Visit } from '../../../domain/entities/visit.entity';

@Injectable()
export class RecordVisitUseCase implements UseCase<RecordVisitCommand, VisitDto> {
  constructor(
    @Inject(VISIT_REPOSITORY)
    private readonly repository: VisitRepositoryPort,
  ) {}

  async execute(command: RecordVisitCommand): Promise<VisitDto> {
    const visit = Visit.record({
      resellerId: command.resellerId,
      visitorId: command.visitorId,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      referrer: command.referrer,
      pageUrl: command.pageUrl,
    });

    const saved = await this.repository.save(visit);
    return VisitDto.fromDomain(saved);
  }
}
