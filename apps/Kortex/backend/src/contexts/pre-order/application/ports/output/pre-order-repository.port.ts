import { PreOrder, PreOrderStatus } from '../../../domain/entities/pre-order.entity';
import { PreOrderId } from '../../../domain/value-objects/pre-order-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';

export const PRE_ORDER_REPOSITORY = Symbol('PRE_ORDER_REPOSITORY');

export interface PreOrderRepositoryPort {
  listByAccount(accountId: AccountId, statuses?: PreOrderStatus[]): Promise<PreOrder[]>;
  /** Os pré-pedidos que este Modelista criou — a lista do app dele. */
  listByCreator(accountId: AccountId, createdBy: UserId): Promise<PreOrder[]>;
  findById(accountId: AccountId, id: PreOrderId): Promise<PreOrder | null>;
  save(preOrder: PreOrder): Promise<PreOrder>;
}
