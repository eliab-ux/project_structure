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
import { BusinessHourNotFoundException } from '../../../domain/exceptions/business-hour-not-found.exception';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { BusinessHourId } from '../../../domain/value-objects/business-hour-id.vo';

export class RemoveBusinessHourCommand {
  constructor(
    public readonly accountId: string,
    public readonly businessHourId: string,
  ) {}
}

@Injectable()
export class RemoveBusinessHourUseCase implements UseCase<RemoveBusinessHourCommand, void> {
  constructor(
    @Inject(BUSINESS_HOUR_REPOSITORY)
    private readonly businessHourRepository: BusinessHourRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RemoveBusinessHourCommand): Promise<void> {
    const accountId = AccountId.from(command.accountId);
    const id = BusinessHourId.from(command.businessHourId);

    // O `findById` já é escopado por conta, então uma janela de outro tenant responde 404 — e não
    // 403. É de propósito: 403 confirmaria que o id existe em algum lugar.
    const existing = await this.businessHourRepository.findById(accountId, id);
    if (!existing) {
      throw new BusinessHourNotFoundException();
    }

    await this.unitOfWork.execute(async () => {
      await this.businessHourRepository.delete(accountId, id);
    });
  }
}
