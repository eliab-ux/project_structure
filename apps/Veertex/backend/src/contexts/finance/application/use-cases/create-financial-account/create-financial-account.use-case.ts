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
import { FinancialAccount } from '../../../domain/entities/financial-account.entity';
import { FinancialAccountType } from '../../../domain/financial-account-type';
import { FinancialAccountDto } from '../../dto/finance.dto';

export class CreateFinancialAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      name: string;
      type: FinancialAccountType;
      institution?: string | null;
      initialBalance?: number | null;
    },
  ) {}
}

/** Cadastra uma conta financeira (§2.3 do 05). */
@Injectable()
export class CreateFinancialAccountUseCase implements UseCase<
  CreateFinancialAccountCommand,
  FinancialAccountDto
> {
  constructor(
    @Inject(FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly accounts: FinancialAccountRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateFinancialAccountCommand): Promise<FinancialAccountDto> {
    const account = FinancialAccount.create({
      accountId: command.accountId,
      name: command.input.name,
      type: command.input.type,
      institution: command.input.institution ?? null,
      initialBalance: command.input.initialBalance ?? 0,
    });
    return this.uow.execute(async () => {
      const saved = await this.accounts.save(account);
      return FinancialAccountDto.fromDomain(saved);
    });
  }
}
