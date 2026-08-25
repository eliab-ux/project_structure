import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '../../ports/output/reseller-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';

export class ApproveResellerCommand {
  constructor(
    public readonly resellerId: string,
    public readonly approvedBy: string,
  ) {}
}

@Injectable()
export class ApproveResellerRegistrationUseCase implements UseCase<ApproveResellerCommand, void> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ApproveResellerCommand): Promise<void> {
    const resellerId = ResellerId.from(command.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);

    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    reseller.approve(command.approvedBy);

    await this.unitOfWork.execute(async () => {
      await this.resellerRepository.save(reseller);
    });
  }
}
