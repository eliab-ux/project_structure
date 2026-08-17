import { Customer } from '../../../domain/entities/customer.entity';
import { CustomerDocument } from '../../../domain/value-objects/customer-document.vo';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepositoryPort {
  listByAccount(accountId: AccountId): Promise<Customer[]>;
  /** Só os ativos — é o que a fila do Modelista e o pré-pedido da Fase 3 vão consumir. */
  listActiveByAccount(accountId: AccountId): Promise<Customer[]>;
  findById(accountId: AccountId, id: CustomerId): Promise<Customer | null>;
  /** Unicidade é POR CONTA: duas contas podem atender o mesmo cliente (spec §4.4). */
  findByDocument(accountId: AccountId, document: CustomerDocument): Promise<Customer | null>;
  save(customer: Customer): Promise<Customer>;
}
