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
import { FinancialTitleDto } from '../../dto/finance.dto';

export class CreateRecurringPayableCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      companyId: string;
      contactId?: string | null;
      categoryId?: string | null;
      description: string;
      amount: number;
      firstDueDate: Date;
      occurrences: number;
    },
  ) {}
}

/**
 * Recorrência SIMPLES a pagar (§2.2 do 05): repetir N meses (aluguel, energia). Materializa `N`
 * títulos a pagar de uma vez, com o vencimento avançando um mês por parcela e a descrição marcando
 * `(i/N)`. Sem OFX/agendador — é a recorrência do V1: títulos concretos, editáveis um a um depois.
 *
 * O dia do vencimento segue `firstDueDate`, com CLAMP para o último dia em mês mais curto
 * (31/jan + 1 mês → 28/29-fev — decisão de 23/08/2026): o estouro do `Date` para 02/03 é surpresa
 * para quem esperava "todo dia 31"; o último dia do mês é a expectativa de quem dita aluguel.
 */
@Injectable()
export class CreateRecurringPayableUseCase implements UseCase<
  CreateRecurringPayableCommand,
  FinancialTitleDto[]
> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateRecurringPayableCommand): Promise<FinancialTitleDto[]> {
    const occurrences = Math.max(1, Math.min(60, Math.trunc(command.input.occurrences)));
    const first = command.input.firstDueDate;

    return this.uow.execute(async () => {
      const created: FinancialTitleDto[] = [];
      for (let i = 0; i < occurrences; i += 1) {
        // Clamp: o dia pretendido nunca passa do último dia do mês-alvo (dia 0 do mês seguinte).
        const lastDayOfTarget = new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i + 1, 0),
        ).getUTCDate();
        const dueDate = new Date(
          Date.UTC(
            first.getUTCFullYear(),
            first.getUTCMonth() + i,
            Math.min(first.getUTCDate(), lastDayOfTarget),
          ),
        );
        const title = FinancialTitle.create({
          accountId: command.accountId,
          companyId: command.input.companyId,
          direction: 'payable',
          contactId: command.input.contactId ?? null,
          categoryId: command.input.categoryId ?? null,
          description:
            occurrences > 1
              ? `${command.input.description} (${i + 1}/${occurrences})`
              : command.input.description,
          amount: command.input.amount,
          dueDate,
          origin: 'manual',
        });
        created.push(FinancialTitleDto.fromDomain(await this.titles.save(title)));
      }
      return created;
    });
  }
}
