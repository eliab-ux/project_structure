import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class CutId extends UuidId {
  static from(value: string): CutId {
    return new CutId(UuidId.parse(value, 'Identificador da matriz'));
  }

  static create(): CutId {
    return new CutId(UuidId.generate());
  }
}
