import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class FabricId extends UuidId {
  static from(value: string): FabricId {
    return new FabricId(UuidId.parse(value, 'Identificador do tecido'));
  }

  static create(): FabricId {
    return new FabricId(UuidId.generate());
  }
}
