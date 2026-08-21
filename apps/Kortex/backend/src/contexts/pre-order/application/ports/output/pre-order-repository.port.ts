import { PreOrder, PreOrderStatus } from '../../../domain/entities/pre-order.entity';
import { PreOrderItem } from '../../../domain/entities/pre-order-item.entity';
import { PreOrderId } from '../../../domain/value-objects/pre-order-id.vo';
import { PreOrderItemId } from '../../../domain/value-objects/pre-order-item-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';

export const PRE_ORDER_REPOSITORY = Symbol('PRE_ORDER_REPOSITORY');

export interface PreOrderRepositoryPort {
  listByAccount(accountId: AccountId, statuses?: PreOrderStatus[]): Promise<PreOrder[]>;
  /** Os pré-pedidos que este Modelista criou — a lista do app dele. */
  listByCreator(accountId: AccountId, createdBy: UserId): Promise<PreOrder[]>;

  /**
   * Quantos pedidos ainda esperam reserva.
   *
   * `count` e não `list(...).length`: isto roda a cada navegação do painel, e trazer a lista
   * inteira — com cliente, tecido e produto resolvidos — para descobrir um número seria pagar o
   * preço de uma tela para desenhar um balãozinho.
   */
  countOpen(accountId: AccountId): Promise<number>;
  findById(accountId: AccountId, id: PreOrderId): Promise<PreOrder | null>;

  /**
   * As matrizes declaradas com estes ids, em uma consulta.
   *
   * Quem aponta o corte precisa saber a ordem da matriz (`sequence`) para mostrá-la na tela, mas
   * não precisa do pedido inteiro. Uma consulta por corte transformaria a lista de matrizes de
   * uma reserva em N idas ao banco para desenhar N números.
   */
  findItemsByIds(accountId: AccountId, ids: PreOrderItemId[]): Promise<PreOrderItem[]>;

  save(preOrder: PreOrder): Promise<PreOrder>;
}
