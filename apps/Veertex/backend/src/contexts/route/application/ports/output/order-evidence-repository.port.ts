import { OrderEvidence } from '../../../domain/entities/order-evidence.entity';

export const ORDER_EVIDENCE_REPOSITORY = Symbol('ORDER_EVIDENCE_REPOSITORY');

export interface OrderEvidenceRepositoryPort {
  listByOrder(orderId: string): Promise<OrderEvidence[]>;
  /** A evidência de GPS VIGENTE do pedido (a mais recente da cadeia). */
  findCurrentGps(orderId: string): Promise<OrderEvidence | null>;
  /** Append-only — evidência nunca é alterada nem removida. */
  save(evidence: OrderEvidence): Promise<OrderEvidence>;
}
