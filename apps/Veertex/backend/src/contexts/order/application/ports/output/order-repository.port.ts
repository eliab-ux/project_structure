import { Order } from '../../../domain/entities/order.entity';
import { OrderId } from '../../../domain/value-objects/order-id.vo';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface ListOrdersFilter {
  /** Pedidos de UMA viagem (04 §3.1) — a tela do acerto filtra no servidor, não no cliente. */
  tripId?: string | null;
  status?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  /** Filtro por vendedor — usado pela carteirização (filtro pelo id do TOKEN, nunca do cliente). */
  salesRepId?: string | null;
  /** Período por data de referência (§2.7), inclusivo. */
  referenceFrom?: Date | null;
  referenceTo?: Date | null;
  search?: string | null;
}

export interface OrderRepositoryPort {
  findById(id: OrderId): Promise<Order | null>;
  list(filter: ListOrdersFilter): Promise<Order[]>;

  /**
   * Idempotência do SYNC do app de campo (proposta aprovada 23/08/2026, antecipada na Leva 2): o
   * aparelho gera um `client_uuid` por mutação da outbox; reenvio após queda de rede ENCONTRA o
   * registro em vez de duplicá-lo. Opcional no port: fakes de teste e chamadas da retaguarda (sem
   * uuid) não precisam dele. Índice único parcial (account_id, client_uuid) é a rede contra
   * corrida — a outbox reenvia sequencialmente, e o retry seguinte encontra o existente.
   */
  findByClientUuid?(clientUuid: string): Promise<Order | null>;
  save(order: Order, options?: { clientUuid?: string | null }): Promise<Order>;

  /**
   * O próximo número de pedido da empresa (§2.6: numeração POR empresa). Concorrência-segura por
   * `SELECT ... FOR UPDATE` numa tabela de contador — não é um campo, é design próprio, como o
   * §2.6 exige. Roda dentro da transação do use case.
   */
  nextOrderNumber(companyId: string): Promise<number>;
}
