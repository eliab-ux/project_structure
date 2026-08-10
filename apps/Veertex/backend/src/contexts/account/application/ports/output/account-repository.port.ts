import { Account } from '../../../domain/entities/account.entity';
import { AccountId } from '../../../domain/value-objects/account-id.vo';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface AccountRepositoryPort {
  /**
   * Reads the account. Under RLS the runtime role only ever sees the row matching the established
   * scope, so passing an id other than the request's returns null rather than another tenant.
   */
  findById(id: AccountId): Promise<Account | null>;

  /** Uniqueness check at onboarding. Operator path (CLI) only — see `create-account.cli.ts`. */
  findByDocument(document: string): Promise<Account | null>;

  save(account: Account): Promise<Account>;
}
