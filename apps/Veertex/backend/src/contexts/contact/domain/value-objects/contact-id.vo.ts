import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class ContactId extends UuidId {
  static readonly entityName = 'contato';

  constructor(props: { value: string }) {
    super(props);
  }
}
