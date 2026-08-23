import { OrderEvidence } from '../../../domain/entities/order-evidence.entity';

export const ORDER_EVIDENCE_REPOSITORY = Symbol('ORDER_EVIDENCE_REPOSITORY');

export interface OrderEvidenceRepositoryPort {
  listByOrder(orderId: string): Promise<OrderEvidence[]>;
  /** A evidência de GPS VIGENTE do pedido (a mais recente da cadeia). */
  findCurrentGps(orderId: string): Promise<OrderEvidence | null>;
  /** Append-only — evidência nunca é alterada nem removida. */
  /**
   * Idempotência do SYNC do app de campo (proposta aprovada 23/08/2026, antecipada na Leva 2): o
   * aparelho gera um `client_uuid` por mutação da outbox; reenvio após queda de rede ENCONTRA o
   * registro em vez de duplicá-lo. Opcional no port: fakes de teste e chamadas da retaguarda (sem
   * uuid) não precisam dele. Índice único parcial (account_id, client_uuid) é a rede contra
   * corrida — a outbox reenvia sequencialmente, e o retry seguinte encontra o existente.
   */
  findByClientUuid?(clientUuid: string): Promise<OrderEvidence | null>;

  save(evidence: OrderEvidence, options?: { clientUuid?: string | null }): Promise<OrderEvidence>;
}
