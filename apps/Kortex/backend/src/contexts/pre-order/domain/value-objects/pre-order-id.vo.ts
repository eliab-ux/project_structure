import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class PreOrderId extends UuidId {
  static from(value: string): PreOrderId {
    return new PreOrderId(UuidId.parse(value, 'Identificador do pré-pedido'));
  }

  static create(): PreOrderId {
    return new PreOrderId(UuidId.generate());
  }
}
