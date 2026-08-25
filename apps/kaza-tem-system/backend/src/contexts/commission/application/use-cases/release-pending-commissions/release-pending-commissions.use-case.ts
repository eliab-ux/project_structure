import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_REPOSITORY,
  CommissionRepositoryPort,
} from '../../ports/output/commission-repository.port';

@Injectable()
export class ReleasePendingCommissionsUseCase implements UseCase<void, number> {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly repository: CommissionRepositoryPort,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async execute(): Promise<number> {
    const pending = await this.repository.findReadyToRelease();
    let released = 0;

    for (const commission of pending) {
      commission.release();
      await this.repository.save(commission);
      released++;
    }

    return released;
  }
}
