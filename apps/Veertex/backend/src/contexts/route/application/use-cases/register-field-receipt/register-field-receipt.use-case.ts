import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FIELD_RECEIPT_REPOSITORY,
  FieldReceiptRepositoryPort,
} from '../../ports/output/field-receipt-repository.port';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import { FieldReceipt, FieldReceiptMethod } from '../../../domain/entities/field-receipt.entity';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class RegisterFieldReceiptCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      tripId: string;
      /** Título cobrado (da carteira). `null` = "outros recebimentos" (à vista, fora da carteira). */
      titleId?: string | null;
      method: FieldReceiptMethod;
      amount: number;
      interest?: number | null;
      /** Idempotência do sync de campo: reenvio com o MESMO uuid devolve o lançamento existente. */
      clientUuid?: string | null;
    },
  ) {}
}

export interface FieldReceiptResult {
  id: string;
  status: string;
  insideWallet: boolean;
}

/**
 * LANÇA um recebimento em campo como **proposta** (§3.3 do 04 — primeiro estágio). NADA é baixado no
 * FIN aqui: a baixa acontece só na efetivação da retaguarda (`EffectuateFieldReceipt`). É o desenho
 * que o app offline usará; na retaguarda-V1 o operador chama os dois em sequência.
 */
@Injectable()
export class RegisterFieldReceiptUseCase implements UseCase<
  RegisterFieldReceiptCommand,
  FieldReceiptResult
> {
  constructor(
    @Inject(FIELD_RECEIPT_REPOSITORY) private readonly receipts: FieldReceiptRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterFieldReceiptCommand): Promise<FieldReceiptResult> {
    return this.uow.execute(async () => {
      // Idempotência do sync: a outbox reenviou? Devolve o que já existe.
      if (command.input.clientUuid) {
        const existing = await this.receipts.findByClientUuid?.(command.input.clientUuid);
        if (existing) {
          return { id: existing.id, status: existing.status, insideWallet: existing.insideWallet };
        }
      }

      const trip = await this.trips.findById(command.input.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      const receipt = FieldReceipt.create({
        accountId: command.accountId,
        tripId: command.input.tripId,
        titleId: command.input.titleId ?? null,
        method: command.input.method,
        amount: command.input.amount,
        interest: command.input.interest ?? null,
      });
      const saved = await this.receipts.save(receipt, { clientUuid: command.input.clientUuid ?? null });
      return { id: saved.id, status: saved.status, insideWallet: saved.insideWallet };
    });
  }
}
