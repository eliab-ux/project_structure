import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_ACCOUNT_REPOSITORY,
  FinancialAccountRepositoryPort,
} from '../../ports/output/financial-account-repository.port';
import { FinancialAccountDto } from '../../dto/finance.dto';
import { FinancialAccountNotFoundException } from '../../../domain/exceptions/finance-exceptions';

export class UpdateFinancialAccountCommand {
  constructor(
    public readonly id: string,
    public readonly input: { name?: string; institution?: string | null; active?: boolean },
  ) {}
}

/** Edita/desativa uma conta financeira (§2.3 do 05). Tipo e saldo inicial não mudam por aqui. */
@Injectable()
export class UpdateFinancialAccountUseCase implements UseCase<
  UpdateFinancialAccountCommand,
  FinancialAccountDto
> {
  constructor(
    @Inject(FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly accounts: FinancialAccountRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateFinancialAccountCommand): Promise<FinancialAccountDto> {
    return this.uow.execute(async () => {
      const account = await this.accounts.findById(command.id);
      if (!account) {
        throw new FinancialAccountNotFoundException();
      }
      account.edit(command.input);
      const saved = await this.accounts.save(account);
      return FinancialAccountDto.fromDomain(saved);
    });
  }
}
