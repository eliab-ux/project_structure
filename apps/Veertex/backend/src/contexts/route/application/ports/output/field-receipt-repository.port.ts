import { FieldReceipt } from '../../../domain/entities/field-receipt.entity';

export const FIELD_RECEIPT_REPOSITORY = Symbol('FIELD_RECEIPT_REPOSITORY');

export interface FieldReceiptRepositoryPort {
  findById(id: string): Promise<FieldReceipt | null>;
  listByTrip(tripId: string): Promise<FieldReceipt[]>;
  /**
   * Idempotência do SYNC do app de campo (proposta aprovada 23/08/2026, antecipada na Leva 2): o
   * aparelho gera um `client_uuid` por mutação da outbox; reenvio após queda de rede ENCONTRA o
   * registro em vez de duplicá-lo. Opcional no port: fakes de teste e chamadas da retaguarda (sem
   * uuid) não precisam dele. Índice único parcial (account_id, client_uuid) é a rede contra
   * corrida — a outbox reenvia sequencialmente, e o retry seguinte encontra o existente.
   */
  findByClientUuid?(clientUuid: string): Promise<FieldReceipt | null>;

  save(receipt: FieldReceipt, options?: { clientUuid?: string | null }): Promise<FieldReceipt>;
}
