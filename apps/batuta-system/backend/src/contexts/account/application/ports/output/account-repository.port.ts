import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { Account } from '../../../domain/entities/account.entity';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { AccountStatus } from '../../../domain/value-objects/account-status.vo';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface ListAccountsFilter extends PaginationParams {
  status?: AccountStatus;
  search?: string;
}

/**
 * `accounts` carries no `account_id`, so the global tenant filter cannot protect it. Therefore
 * the port itself separates the two scopes: `findById` is what a tenant request uses (the id
 * comes from the JWT), and the `*ForPlatform` methods are only reachable behind
 * PlatformAdminGuard.
 */
export interface AccountRepositoryPort {
  findById(id: AccountId): Promise<Account | null>;
  existsByDocument(document: string): Promise<boolean>;
  save(account: Account): Promise<Account>;
  listForPlatform(filter: ListAccountsFilter): Promise<PaginatedResult<Account>>;
}
