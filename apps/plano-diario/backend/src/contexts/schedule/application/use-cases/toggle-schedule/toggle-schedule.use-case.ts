import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ScheduleNotFoundException } from '../../../domain/exceptions/schedule.exceptions';
import { ScheduleDto } from '../../dto/schedule.dto';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../ports/output/schedule-repository.port';

/** Liga/pausa o envio diário. Pausado, o tick do scheduler simplesmente ignora o agendamento. */
@Injectable()
export class ToggleScheduleUseCase implements UseCase<
  { userId: string; isActive: boolean },
  ScheduleDto
> {
  private readonly logger = new Logger(ToggleScheduleUseCase.name);

  constructor(@Inject(SCHEDULE_REPOSITORY) private readonly repository: ScheduleRepositoryPort) {}

  async execute(command: { userId: string; isActive: boolean }): Promise<ScheduleDto> {
    const schedule = await this.repository.findByUserId(command.userId);
    if (!schedule) {
      throw new ScheduleNotFoundException();
    }

    schedule.setActive(command.isActive);
    const saved = await this.repository.save(schedule);
    this.logger.log(command.isActive ? 'Envio diário ativado' : 'Envio diário pausado', {
      userId: command.userId,
    });
    return ScheduleDto.fromDomain(saved);
  }
}
