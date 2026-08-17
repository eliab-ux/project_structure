import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class WaitingListEntryId extends UuidId {
  static from(value: string): WaitingListEntryId {
    return new WaitingListEntryId(UuidId.parse(value, 'Identificador da entrada na fila'));
  }

  static create(): WaitingListEntryId {
    return new WaitingListEntryId(UuidId.generate());
  }
}
