import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class PreOrderItemId extends UuidId {
  static from(value: string): PreOrderItemId {
    return new PreOrderItemId(UuidId.parse(value, 'Identificador da matriz do pedido'));
  }

  static create(): PreOrderItemId {
    return new PreOrderItemId(UuidId.generate());
  }
}
