import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../../../finance/application/ports/output/financial-title-repository.port';
import { FinancialTitle } from '../../../../finance/domain/entities/financial-title.entity';
import { InvalidChargeException } from '../../../domain/exceptions/billing-exceptions';

export class RenegotiateTitlesCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      titleIds: string[];
      installments: { amount: number; dueDate: Date }[];
      description?: string | null;
    },
  ) {}
}

export interface RenegotiationResult {
  renegotiatedTitleIds: string[];
  newTitleIds: string[];
}

/**
 * RENEGOCIAÇÃO MÍNIMA (06 §2.6): os títulos antigos são SINALIZADOS `renegotiated` (lançamento
 * novo, nunca alteração — o histórico continua legível) e os novos nascem com origem
 * `renegotiation`, na MESMA empresa e contato. O total novo não precisa igualar o antigo (juros
 * do acordo, desconto de boa vontade) — mas os dois totais ficam na descrição, visíveis.
 */
@Injectable()
export class RenegotiateTitlesUseCase implements UseCase<
  RenegotiateTitlesCommand,
  RenegotiationResult
> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RenegotiateTitlesCommand): Promise<RenegotiationResult> {
    const { titleIds, installments } = command.input;
    if (titleIds.length === 0 || installments.length === 0) {
      throw new InvalidChargeException('Escolha os títulos e as novas parcelas.');
    }

    return this.uow.execute(async () => {
      const oldTitles: FinancialTitle[] = [];
      for (const id of titleIds) {
        const title = await this.titles.findById(id);
        if (!title || title.direction !== 'receivable') {
          throw new InvalidChargeException(`Título ${id.slice(0, 8)} não encontrado.`);
        }
        if (title.status !== 'open' && title.status !== 'partial') {
          throw new InvalidChargeException(
            `Título ${id.slice(0, 8)} não está em aberto — nada a renegociar.`,
          );
        }
        oldTitles.push(title);
      }

      // Todos do MESMO contato e empresa — renegociar dívidas de clientes diferentes num acordo
      // só é engano de seleção.
      const contactIds = new Set(oldTitles.map((title) => title.contactId ?? ''));
      const companyIds = new Set(oldTitles.map((title) => title.companyId));
      if (contactIds.size > 1 || companyIds.size > 1) {
        throw new InvalidChargeException(
          'Renegociação cobre títulos de UM cliente e UMA empresa por vez.',
        );
      }

      const oldTotal = oldTitles.reduce((sum, title) => sum + title.openAmount, 0);
      const renegotiatedTitleIds: string[] = [];
      for (const title of oldTitles) {
        title.flagRenegotiated();
        await this.titles.save(title);
        renegotiatedTitleIds.push(title.id);
      }

      const base = oldTitles[0];
      const newTitleIds: string[] = [];
      for (let i = 0; i < installments.length; i += 1) {
        const installment = installments[i];
        if (!(installment.amount > 0)) {
          throw new InvalidChargeException('Parcela renegociada precisa de valor positivo.');
        }
        const title = FinancialTitle.create({
          accountId: command.accountId,
          companyId: base.companyId,
          direction: 'receivable',
          contactId: base.contactId,
          categoryId: null,
          description:
            (command.input.description?.trim() ||
              `Renegociação de ${oldTitles.length} título(s) — original ${oldTotal.toFixed(2)}`) +
            ` (${i + 1}/${installments.length})`,
          amount: installment.amount,
          dueDate: installment.dueDate,
          origin: 'renegotiation',
        });
        const saved = await this.titles.save(title);
        newTitleIds.push(saved.id);
      }

      return { renegotiatedTitleIds, newTitleIds };
    });
  }
}
