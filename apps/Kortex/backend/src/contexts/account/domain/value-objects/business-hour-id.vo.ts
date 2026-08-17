import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class BusinessHourId extends UuidId {
  static from(value: string): BusinessHourId {
    return new BusinessHourId(UuidId.parse(value, 'Identificador da janela'));
  }

  static create(): BusinessHourId {
    return new BusinessHourId(UuidId.generate());
  }
}
