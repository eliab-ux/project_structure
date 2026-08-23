import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  SettleTitleCommand,
  SettleTitleUseCase,
} from '../../../../finance/application/use-cases/settle-title/settle-title.use-case';
import { SettlementMethod } from '../../../../finance/domain/entities/title-settlement.entity';
import {
  FIELD_RECEIPT_REPOSITORY,
  FieldReceiptRepositoryPort,
} from '../../ports/output/field-receipt-repository.port';
import { FieldReceiptNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class EffectuateFieldReceiptCommand {
  constructor(
    public readonly receiptId: string,
    /** Conta financeira que RECEBE (caixa da viagem, banco...) — a retaguarda escolhe. */
    public readonly financialAccountId: string,
  ) {}
}

export interface EffectuateFieldReceiptResult {
  receiptId: string;
  status: string;
  /** Situação do título após a baixa (quando o recebimento é de carteira). */
  titleStatus: string | null;
}

const METHOD_MAP: Record<string, SettlementMethod> = {
  dinheiro: 'dinheiro',
  pix: 'pix',
  cartao: 'cartao',
  cheque: 'cheque',
  deposito: 'transferencia',
};

/**
 * EFETIVA um recebimento em campo (§3.3 do 04 — o segundo estágio, da retaguarda). Só aqui a baixa
 * acontece: recebimento de CARTEIRA baixa o título no FIN (principal = valor; juros de atraso vão
 * como juros da baixa — recebimento classificado, §3.2); "outros recebimentos" (sem título) só mudam
 * de estágio — o caixa deles entra no batimento do fechamento (fatia 5).
 *
 * A venda de consignado (documento fiscal) é emitida no FECHAMENTO do pedido consignado, não aqui —
 * o recebimento pode ser parcial e o pedido agrega vários itens; a composição fina fica com o FIS.
 */
@Injectable()
export class EffectuateFieldReceiptUseCase implements UseCase<
  EffectuateFieldReceiptCommand,
  EffectuateFieldReceiptResult
> {
  constructor(
    @Inject(FIELD_RECEIPT_REPOSITORY) private readonly receipts: FieldReceiptRepositoryPort,
    private readonly settleTitle: SettleTitleUseCase,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: EffectuateFieldReceiptCommand): Promise<EffectuateFieldReceiptResult> {
    return this.uow.execute(async () => {
      const receipt = await this.receipts.findById(command.receiptId);
      if (!receipt) {
        throw new FieldReceiptNotFoundException();
      }

      receipt.effectuate(); // recusa dupla efetivação — a baixa nunca acontece duas vezes

      let titleStatus: string | null = null;
      if (receipt.titleId) {
        const settled = await this.settleTitle.execute(
          new SettleTitleCommand(receipt.titleId, {
            financialAccountId: command.financialAccountId,
            method: METHOD_MAP[receipt.method] ?? 'outro',
            principal: receipt.amount,
            // Juros do campo entram como override (o representante cobrou X de juros, é o que vale).
            interest: receipt.interest,
            fine: 0,
            discount: 0,
          }),
        );
        titleStatus = settled.status;
      }

      const saved = await this.receipts.save(receipt);
      return { receiptId: saved.id, status: saved.status, titleStatus };
    });
  }
}
