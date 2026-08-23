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
import {
  FINANCIAL_ACCOUNT_REPOSITORY,
  FinancialAccountRepositoryPort,
} from '../../ports/output/financial-account-repository.port';
import {
  LATE_CHARGE_PARAMS,
  LateChargeParamsPort,
} from '../../ports/output/late-charge-params.port';
import {
  TitleSettlement,
  SettlementMethod,
} from '../../../domain/entities/title-settlement.entity';
import { computeLateCharges } from '../../../domain/late-charges';
import { FinancialTitleDto } from '../../dto/finance.dto';
import {
  FinancialAccountNotFoundException,
  FinancialTitleNotFoundException,
} from '../../../domain/exceptions/finance-exceptions';

export class SettleTitleCommand {
  constructor(
    public readonly titleId: string,
    public readonly input: {
      financialAccountId: string;
      method: SettlementMethod;
      /** Principal a amortizar. Baixa parcial deixa o saldo no mesmo título (§2.1). */
      principal: number;
      settledAt?: Date | null;
      /** Overrides opcionais — a COB/operador pode informar; ausente, o FIN calcula pelos parâmetros. */
      interest?: number | null;
      fine?: number | null;
      discount?: number | null;
    },
  ) {}
}

/**
 * Dá baixa num título (§2.1 do 05). Baixa parcial deixa saldo residual NO MESMO título (a situação
 * `open→partial→settled` é derivada). Juros e multa são **calculados pelo FIN** a partir dos
 * parâmetros da conta e do atraso (a COB só apresenta) — a menos que venham informados (override).
 * Baixa é append-only; a validação de não exceder o saldo é do agregado.
 */
@Injectable()
export class SettleTitleUseCase implements UseCase<SettleTitleCommand, FinancialTitleDto> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly accounts: FinancialAccountRepositoryPort,
    @Inject(LATE_CHARGE_PARAMS) private readonly lateChargeParams: LateChargeParamsPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SettleTitleCommand): Promise<FinancialTitleDto> {
    return this.uow.execute(async () => {
      const title = await this.titles.findById(command.titleId);
      if (!title) {
        throw new FinancialTitleNotFoundException();
      }

      const financialAccount = await this.accounts.findById(command.input.financialAccountId);
      if (!financialAccount || !financialAccount.active) {
        throw new FinancialAccountNotFoundException();
      }

      const settledAt = command.input.settledAt ?? new Date();

      // FIN calcula juros/multa pelo atraso, salvo override explícito.
      const params = await this.lateChargeParams.forCurrentAccount();
      const charges = computeLateCharges({
        principal: command.input.principal,
        dueDate: title.dueDate,
        paidAt: settledAt,
        monthlyInterestPercent: params.monthlyInterestPercent,
        finePercent: params.finePercent,
      });

      const settlement = TitleSettlement.create({
        financialAccountId: command.input.financialAccountId,
        method: command.input.method,
        principal: command.input.principal,
        interest: command.input.interest ?? charges.interest,
        fine: command.input.fine ?? charges.fine,
        discount: command.input.discount ?? 0,
        settledAt,
      });

      title.addSettlement(settlement);
      const saved = await this.titles.save(title);
      return FinancialTitleDto.fromDomain(saved);
    });
  }
}
