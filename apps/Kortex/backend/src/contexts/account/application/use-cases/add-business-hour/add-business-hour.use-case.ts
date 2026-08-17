import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  BUSINESS_HOUR_REPOSITORY,
  BusinessHourRepositoryPort,
} from '../../ports/output/business-hour-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { BusinessHourDto } from '../../dto/business-hour.dto';
import { BusinessHour } from '../../../domain/entities/business-hour.entity';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { TimeOfDay } from '../../../../../shared/domain/value-objects/time-of-day.vo';

export class AddBusinessHourCommand {
  constructor(
    public readonly accountId: string,
    public readonly weekday: number,
    public readonly startsAt: string,
    public readonly endsAt: string,
  ) {}
}

@Injectable()
export class AddBusinessHourUseCase implements UseCase<AddBusinessHourCommand, BusinessHourDto> {
  constructor(
    @Inject(BUSINESS_HOUR_REPOSITORY)
    private readonly businessHourRepository: BusinessHourRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: AddBusinessHourCommand): Promise<BusinessHourDto> {
    const accountId = AccountId.from(command.accountId);

    const candidate = BusinessHour.create({
      accountId,
      weekday: command.weekday,
      startsAt: TimeOfDay.create(command.startsAt),
      endsAt: TimeOfDay.create(command.endsAt),
    });

    // Carrega só as janelas do dia: são no máximo um punhado, e comparar em memória dá a mensagem
    // que nomeia a janela conflitante — coisa que o erro da constraint do banco não faz.
    const sameDay = await this.businessHourRepository.listByAccountAndWeekday(
      accountId,
      candidate.weekday,
    );
    BusinessHour.assertNoOverlap(sameDay, candidate);

    return this.unitOfWork.execute(async () => {
      const saved = await this.businessHourRepository.save(candidate);
      return BusinessHourDto.fromDomain(saved);
    });
  }
}
