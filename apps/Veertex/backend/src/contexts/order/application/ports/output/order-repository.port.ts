import { Order } from '../../../domain/entities/order.entity';
import { OrderId } from '../../../domain/value-objects/order-id.vo';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface ListOrdersFilter {
  status?: string | null;
  companyId?: string | null;
  /** Filtro por vendedor — usado pela carteirização (filtro pelo id do TOKEN, nunca do cliente). */
  salesRepId?: string | null;
  search?: string | null;
}

export interface OrderRepositoryPort {
  findById(id: OrderId): Promise<Order | null>;
  list(filter: ListOrdersFilter): Promise<Order[]>;
  save(order: Order): Promise<Order>;

  /**
   * O próximo número de pedido da empresa (§2.6: numeração POR empresa). Concorrência-segura por
   * `SELECT ... FOR UPDATE` numa tabela de contador — não é um campo, é design próprio, como o
   * §2.6 exige. Roda dentro da transação do use case.
   */
  nextOrderNumber(companyId: string): Promise<number>;
}
