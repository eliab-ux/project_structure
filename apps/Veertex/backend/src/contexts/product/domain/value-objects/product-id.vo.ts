import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class ProductId extends UuidId {
  static readonly entityName = 'produto';

  constructor(props: { value: string }) {
    super(props);
  }
}
