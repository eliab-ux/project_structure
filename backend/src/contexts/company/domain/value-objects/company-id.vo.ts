import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class CompanyId extends UuidId {
  static readonly entityName = 'empresa';

  constructor(props: { value: string }) {
    super(props);
  }
}
