import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class ProductTypeId extends UuidId {
  static from(value: string): ProductTypeId {
    return new ProductTypeId(UuidId.parse(value, 'Identificador do tipo de produto'));
  }

  static create(): ProductTypeId {
    return new ProductTypeId(UuidId.generate());
  }
}
