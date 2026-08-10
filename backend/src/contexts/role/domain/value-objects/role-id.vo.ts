import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class RoleId extends UuidId {
  static readonly entityName = 'papel';

  constructor(props: { value: string }) {
    super(props);
  }
}
