import { AccountStatus } from '../../../../account/domain/value-objects/account-status.vo';

export class ListAccountsQuery {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly status?: AccountStatus,
    public readonly search?: string,
  ) {}
}
