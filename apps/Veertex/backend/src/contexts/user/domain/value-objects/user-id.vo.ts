import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class UserId extends UuidId {
  static readonly entityName = 'usuário';

  constructor(props: { value: string }) {
    super(props);
  }
}
