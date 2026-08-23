import { Injectable } from '@nestjs/common';
import {
  CommissionPayablePort,
  CommissionPayableRequest,
} from '../../../../contexts/commission/application/ports/output/commission-payable.port';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../../../contexts/finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import {
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../../../../contexts/finance/application/ports/output/financial-category-repository.port';
import { Inject } from '@nestjs/common';

/**
 * Materializa a comissão como conta a pagar no FIN (§2.2 do 05) — o adapter que TIROU o port do
 * no-op. Cria um `financial_title` a pagar na empresa escolhida, categorizado pela categoria padrão
 * da operação `commission` (se existir), com vencimento no fim do período apurado.
 */
@Injectable()
export class CommissionPayableViaFinance implements CommissionPayablePort {
  constructor(
    private readonly createTitle: CreateFinancialTitleUseCase,
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
  ) {}

  async materialize(request: CommissionPayableRequest): Promise<string> {
    const category = await this.categories.findByDefaultOperation('commission');

    // Vencimento = último dia do mês do período (YYYY-MM).
    const [year, month] = request.period.split('-').map(Number);
    const dueDate = new Date(Date.UTC(year, month, 0));

    const title = await this.createTitle.execute(
      new CreateFinancialTitleCommand(request.accountId, 'payable', {
        companyId: request.companyId,
        contactId: null,
        categoryId: category?.id ?? null,
        description: `Comissão ${request.period}`,
        amount: request.amount,
        dueDate,
      }),
    );
    return title.id;
  }
}
