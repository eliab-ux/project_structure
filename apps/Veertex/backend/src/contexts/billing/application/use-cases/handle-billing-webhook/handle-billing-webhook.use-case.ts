import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  SettleTitleCommand,
  SettleTitleUseCase,
} from '../../../../finance/application/use-cases/settle-title/settle-title.use-case';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../../../finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import {
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../../../../finance/application/ports/output/financial-category-repository.port';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../../../finance/application/ports/output/financial-title-repository.port';
import { BILLING_PROVIDER, BillingProviderPort } from '../../ports/output/billing-provider.port';
import {
  BILLING_WEBHOOK_EVENT_REPOSITORY,
  BillingWebhookEventRepositoryPort,
  CHARGE_REPOSITORY,
  ChargeRepositoryPort,
} from '../../ports/output/billing-repositories.port';
import {
  BILLING_CONFIG_REPOSITORY,
  BillingConfigRepositoryPort,
} from '../../ports/output/billing-config-repository.port';

export class HandleBillingWebhookCommand {
  constructor(
    public readonly accountId: string,
    public readonly configId: string,
    public readonly rawBody: string,
    public readonly headers: Record<string, string>,
  ) {}
}

export interface WebhookResult {
  outcome: 'settled' | 'cancelled' | 'duplicated' | 'ignored';
}

/**
 * A BAIXA AUTOMÁTICA pelo retorno do provedor (06 §2.2, aceites 2–3):
 *
 *  1. o adapter TRADUZ e VALIDA o payload (assinatura inválida = ignorado, nunca 500 — provedor
 *     reenvia por status, e um 500 aqui viraria loop de retry);
 *  2. IDEMPOTÊNCIA por id externo do evento: `registerOnce` grava a chave na primeira vez e
 *     recusa nas seguintes — a MESMA notificação duas vezes é UMA baixa (aceite 3);
 *  3. pago → baixa no FIN (conta financeira de LIQUIDAÇÃO da config; método = instrumento) com o
 *     título e a origem registrados;
 *  4. tarifa do evento → conta a pagar com a categoria padrão de tarifa bancária (árvore do FIN).
 */
@Injectable()
export class HandleBillingWebhookUseCase implements UseCase<
  HandleBillingWebhookCommand,
  WebhookResult
> {
  private readonly logger = new Logger(HandleBillingWebhookUseCase.name);

  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProviderPort,
    @Inject(CHARGE_REPOSITORY) private readonly charges: ChargeRepositoryPort,
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
    @Inject(BILLING_WEBHOOK_EVENT_REPOSITORY)
    private readonly webhookEvents: BillingWebhookEventRepositoryPort,
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    private readonly settleTitle: SettleTitleUseCase,
    private readonly createTitle: CreateFinancialTitleUseCase,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: HandleBillingWebhookCommand): Promise<WebhookResult> {
    const event = await this.provider.parseWebhook(command.rawBody, command.headers);
    if (!event) {
      // Payload que o adapter não reconhece/valida: ignorado com log — nunca 500 (loop de retry).
      this.logger.warn('Webhook de cobrança ignorado (payload não reconhecido)', {
        configId: command.configId,
      });
      return { outcome: 'ignored' };
    }

    return this.uow.execute(async () => {
      const first = await this.webhookEvents.registerOnce(
        event.externalEventId,
        command.accountId,
      );
      if (!first) {
        return { outcome: 'duplicated' };
      }

      const charge = await this.charges.findByProviderChargeId(event.providerChargeId);
      if (!charge) {
        this.logger.warn('Webhook para cobrança desconhecida', {
          providerChargeId: event.providerChargeId,
        });
        return { outcome: 'ignored' };
      }

      if (event.type === 'cancelled') {
        charge.cancel();
        await this.charges.save(charge);
        return { outcome: 'cancelled' };
      }

      // Pago: baixa no FIN na conta de liquidação da config, método = instrumento da charge.
      const config = await this.configs.findById(command.configId);
      if (!config) {
        this.logger.warn('Webhook sem config correspondente', { configId: command.configId });
        return { outcome: 'ignored' };
      }

      charge.markPaid(event.paidAt ?? new Date());
      await this.charges.save(charge);

      // Principal = o que o provedor reportou; sem valor no evento, o saldo em aberto do título.
      const title = await this.titles.findById(charge.titleId);
      const principal = event.paidAmount ?? title?.openAmount ?? 0;
      await this.settleTitle.execute(
        new SettleTitleCommand(charge.titleId, {
          financialAccountId: config.settlementAccountId,
          method: charge.kind === 'pix' ? 'pix' : 'boleto',
          principal,
          settledAt: event.paidAt ?? null,
        }),
      );

      // Tarifa do evento (06 §2.2): conta a pagar com a categoria padrão de tarifa bancária.
      if (event.fee && event.fee > 0) {
        const category = await this.categories.findByDefaultOperation('bank_fee');
        await this.createTitle.execute(
          new CreateFinancialTitleCommand(command.accountId, 'payable', {
            companyId: charge.companyId,
            contactId: null,
            categoryId: category?.id ?? null,
            description: `Tarifa ${charge.kind} — ${config.provider}`,
            amount: event.fee,
            dueDate: event.paidAt ?? new Date(),
          }),
        );
      }

      return { outcome: 'settled' };
    });
  }
}
