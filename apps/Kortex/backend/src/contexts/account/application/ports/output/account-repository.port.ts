import { Account } from '../../../domain/entities/account.entity';
import { AccountId } from '../../../domain/value-objects/account-id.vo';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface AccountRepositoryPort {
  findById(id: AccountId): Promise<Account | null>;
  save(account: Account): Promise<Account>;
}
