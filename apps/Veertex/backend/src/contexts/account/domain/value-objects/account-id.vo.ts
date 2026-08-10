import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

/**
 * The tenant identifier. Every business row in the database carries this value in `account_id`,
 * and every RLS policy compares against it.
 */
export class AccountId extends UuidId {
  static readonly entityName = 'conta';

  constructor(props: { value: string }) {
    super(props);
  }
}
