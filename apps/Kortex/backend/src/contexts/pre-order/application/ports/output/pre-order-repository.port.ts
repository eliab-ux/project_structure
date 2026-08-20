import { PreOrder, PreOrderStatus } from '../../../domain/entities/pre-order.entity';
import { PreOrderId } from '../../../domain/value-objects/pre-order-id.vo';
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
  save(preOrder: PreOrder): Promise<PreOrder>;
}
