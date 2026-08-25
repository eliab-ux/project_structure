import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { UpdateResellerBankInfoCommand } from './update-bank-info.command';
import { RESELLER_REPOSITORY, ResellerRepositoryPort } from '../../ports/output/reseller-repository.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';
import { ResellerDto } from '../../dto/reseller.dto';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';

@Injectable()
export class UpdateResellerBankInfoUseCase implements UseCase<UpdateResellerBankInfoCommand, ResellerDto> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateResellerBankInfoCommand): Promise<ResellerDto> {
    const reseller = await this.resellerRepository.findById(ResellerId.from(command.resellerId));
    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    reseller.updateBankInfo({
      bankName: command.bankName ?? null,
      bankCode: command.bankCode ?? null,
      bankAgency: command.bankAgency ?? null,
      bankAccount: command.bankAccount ?? null,
      bankAccountType: command.bankAccountType ?? null,
      bankHolderName: command.bankHolderName ?? null,
      bankHolderCpf: command.bankHolderCpf ?? null,
      pixKey: command.pixKey ?? null,
      pixKeyType: command.pixKeyType ?? null,
    });

    const updated = await this.unitOfWork.execute(async () => {
      return this.resellerRepository.save(reseller);
    });

    return ResellerDto.fromDomain(updated);
  }
}
