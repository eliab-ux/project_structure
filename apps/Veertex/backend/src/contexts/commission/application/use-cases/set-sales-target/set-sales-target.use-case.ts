import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  SALES_TARGET_REPOSITORY,
  SalesTargetRepositoryPort,
} from '../../ports/output/sales-target-repository.port';
import { SalesTarget } from '../../../domain/entities/sales-target.entity';
import { SalesTargetDto } from '../../dto/commission.dto';

export class SetSalesTargetCommand {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly period: string,
    public readonly targetValue: number,
  ) {}
}

/**
 * Cadastra/atualiza a meta de um vendedor num período (§2 do 02A). Upsert por `(userId, period)`: a
 * unicidade é do repositório; aqui só monta e delega.
 */
@Injectable()
export class SetSalesTargetUseCase implements UseCase<SetSalesTargetCommand, SalesTargetDto> {
  constructor(
    @Inject(SALES_TARGET_REPOSITORY) private readonly targets: SalesTargetRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetSalesTargetCommand): Promise<SalesTargetDto> {
    return this.uow.execute(async () => {
      const existing = await this.targets.findByUserPeriod(command.userId, command.period);
      if (existing) {
        existing.changeTarget(command.targetValue);
        return SalesTargetDto.fromDomain(await this.targets.save(existing));
      }
      const target = SalesTarget.create({
        accountId: command.accountId,
        userId: command.userId,
        period: command.period,
        targetValue: command.targetValue,
      });
      return SalesTargetDto.fromDomain(await this.targets.save(target));
    });
  }
}
