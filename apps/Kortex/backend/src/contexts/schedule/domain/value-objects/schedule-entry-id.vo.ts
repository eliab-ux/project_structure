import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class ScheduleEntryId extends UuidId {
  static from(value: string): ScheduleEntryId {
    return new ScheduleEntryId(UuidId.parse(value, 'Identificador do compromisso'));
  }

  static create(): ScheduleEntryId {
    return new ScheduleEntryId(UuidId.generate());
  }
}
