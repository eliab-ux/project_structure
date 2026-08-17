import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class ReservationId extends UuidId {
  static from(value: string): ReservationId {
    return new ReservationId(UuidId.parse(value, 'Identificador da reserva'));
  }

  static create(): ReservationId {
    return new ReservationId(UuidId.generate());
  }
}
