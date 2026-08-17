import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class SlotNoticeId extends UuidId {
  static from(value: string): SlotNoticeId {
    return new SlotNoticeId(UuidId.parse(value, 'Identificador do aviso'));
  }

  static create(): SlotNoticeId {
    return new SlotNoticeId(UuidId.generate());
  }
}
