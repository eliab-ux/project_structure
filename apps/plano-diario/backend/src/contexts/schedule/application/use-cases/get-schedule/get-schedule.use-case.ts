import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ScheduleDto } from '../../dto/schedule.dto';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../ports/output/schedule-repository.port';

/** Devolve `null` quando o usuário ainda não configurou — não é erro, é o estado inicial. */
@Injectable()
export class GetScheduleUseCase implements UseCase<{ userId: string }, ScheduleDto | null> {
  constructor(@Inject(SCHEDULE_REPOSITORY) private readonly repository: ScheduleRepositoryPort) {}

  async execute(command: { userId: string }): Promise<ScheduleDto | null> {
    const schedule = await this.repository.findByUserId(command.userId);
    return schedule ? ScheduleDto.fromDomain(schedule) : null;
  }
}
