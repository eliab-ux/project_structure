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
import { Charge, ChargeKind } from '../../../domain/entities/charge.entity';
import {
  BillingProviderNotConfiguredException,
  InvalidChargeException,
} from '../../../domain/exceptions/billing-exceptions';
import { BILLING_PROVIDER, BillingProviderPort } from '../../ports/output/billing-provider.port';
import {
  CHARGE_REPOSITORY,
  ChargeRepositoryPort,
} from '../../ports/output/billing-repositories.port';
import {
  BILLING_CONFIG_REPOSITORY,
  BillingConfigRepositoryPort,
} from '../../ports/output/billing-config-repository.port';
import {
  BILLING_PAYER_LOOKUP,
  BILLING_PDF_STORAGE,
  BillingPayerLookupPort,
  BillingPdfStoragePort,
} from '../../ports/output/billing-support.ports';

export class EmitChargeCommand {
  constructor(
    public readonly accountId: string,
    public readonly titleId: string,
    public readonly kind: ChargeKind,
  ) {}
}

export interface ChargeDto {
  id: string;
  titleId: string;
  kind: string;
  status: string;
  provider: string;
  digitableLine: string | null;
  pixQrCode: string | null;
  pdfObjectKey: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function chargeToDto(charge: Charge): ChargeDto {
  return {
    id: charge.id,
    titleId: charge.titleId,
    kind: charge.kind,
    status: charge.status,
    provider: charge.provider,
    digitableLine: charge.digitableLine,
    pixQrCode: charge.pixQrCode,
    pdfObjectKey: charge.pdfObjectKey,
    paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
    createdAt: charge.createdAt.toISOString(),
  };
}

/**
 * EMITE o instrumento (06 fatia 1): título a receber em aberto → boleto/Pix no agregador. Sem
 * config/credencial, o provider default recusa LOUD — a fronteira existe; o agregador entra por
 * troca de adapter quando a credencial chegar. Um título tem UMA charge ativa: 2ª via = cancelar a
 * ativa e emitir outra (o cancelamento é explícito, nunca implícito).
 */
@Injectable()
export class EmitChargeUseCase implements UseCase<EmitChargeCommand, ChargeDto> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(CHARGE_REPOSITORY) private readonly charges: ChargeRepositoryPort,
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProviderPort,
    @Inject(BILLING_PAYER_LOOKUP) private readonly payers: BillingPayerLookupPort,
    @Inject(BILLING_PDF_STORAGE) private readonly pdfStorage: BillingPdfStoragePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: EmitChargeCommand): Promise<ChargeDto> {
    return this.uow.execute(async () => {
      const title = await this.titles.findById(command.titleId);
      if (!title || title.direction !== 'receivable') {
        throw new InvalidChargeException('Título a receber não encontrado.');
      }
      if (title.status !== 'open' && title.status !== 'partial') {
        throw new InvalidChargeException(
          `Título ${title.status === 'settled' ? 'já quitado' : 'fora de cobrança'} — nada a emitir.`,
        );
      }

      const active = await this.charges.findActiveByTitle(title.id);
      if (active) {
        throw new InvalidChargeException(
          'Este título já tem uma cobrança ativa. Cancele-a antes de emitir outra (2ª via).',
        );
      }

      const config = await this.configs.getForAccount(title.companyId);
      if (!config || !config.active) {
        throw new BillingProviderNotConfiguredException();
      }

      const payer = title.contactId
        ? await this.payers.findByContactId(title.contactId)
        : null;
      if (!payer) {
        throw new InvalidChargeException(
          'Título sem contato pagador — boleto/Pix precisa de um pagador identificado.',
        );
      }

      const registered = await this.provider.registerCharge({
        kind: command.kind,
        amount: title.openAmount,
        dueDate: title.dueDate,
        description: title.description,
        payer: { name: payer.name, document: payer.document, email: payer.email },
        configId: config.id,
      });

      const charge = Charge.create({
        accountId: command.accountId,
        companyId: title.companyId,
        titleId: title.id,
        kind: command.kind,
        provider: config.provider,
        providerChargeId: registered.providerChargeId,
        digitableLine: registered.digitableLine,
        pixQrCode: registered.pixQrCode,
        // A chave do PDF usa o id EXTERNO (estável e único no provedor) — o id interno da charge
        // ainda não existe neste ponto, e inventar um provisório quebraria a releitura.
        pdfObjectKey: registered.pdfBase64
          ? await this.pdfStorage.store({
              accountId: command.accountId,
              chargeId: registered.providerChargeId,
              pdfBase64: registered.pdfBase64,
            })
          : null,
      });

      return chargeToDto(await this.charges.save(charge));
    });
  }
}
