import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class CustomerId extends UuidId {
  static from(value: string): CustomerId {
    return new CustomerId(UuidId.parse(value, 'Identificador do cliente'));
  }

  static create(): CustomerId {
    return new CustomerId(UuidId.generate());
  }
}
