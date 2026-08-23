import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../ports/output/financial-title-repository.port';
import { FinancialTitle } from '../../../domain/entities/financial-title.entity';
import { TitleDirection, TitleOrigin } from '../../../domain/title-enums';
import { FinancialTitleDto } from '../../dto/finance.dto';

export class CreateFinancialTitleCommand {
  constructor(
    public readonly accountId: string,
    public readonly direction: TitleDirection,
    public readonly input: {
      companyId: string;
      contactId?: string | null;
      categoryId?: string | null;
      description: string;
      amount: number;
      issueDate?: Date | null;
      dueDate: Date;
      /** Origem do título. Default `manual`; o ROT passa `consignment` (§2.1(b) do 05). */
      origin?: TitleOrigin;
    },
  ) {}
}

/**
 * Lançamento MANUAL de título (§2.1/§2.2 do 05), a receber ou a pagar. O nascimento por faturamento
 * (VND) e por consignação (ROT) usa a mesma entidade com outra `origin` — dormente até esses módulos
 * ligarem; aqui a origem é sempre `manual`.
 */
@Injectable()
export class CreateFinancialTitleUseCase implements UseCase<
  CreateFinancialTitleCommand,
  FinancialTitleDto
> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateFinancialTitleCommand): Promise<FinancialTitleDto> {
    const title = FinancialTitle.create({
      accountId: command.accountId,
      companyId: command.input.companyId,
      direction: command.direction,
      contactId: command.input.contactId ?? null,
      categoryId: command.input.categoryId ?? null,
      description: command.input.description,
      amount: command.input.amount,
      issueDate: command.input.issueDate ?? null,
      dueDate: command.input.dueDate,
      origin: command.input.origin ?? 'manual',
    });
    return this.uow.execute(async () => {
      const saved = await this.titles.save(title);
      return FinancialTitleDto.fromDomain(saved);
    });
  }
}
