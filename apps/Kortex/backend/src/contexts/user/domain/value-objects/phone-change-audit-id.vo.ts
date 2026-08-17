import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class PhoneChangeAuditId extends UuidId {
  static from(value: string): PhoneChangeAuditId {
    return new PhoneChangeAuditId(UuidId.parse(value, 'Identificador do registro de auditoria'));
  }

  static create(): PhoneChangeAuditId {
    return new PhoneChangeAuditId(UuidId.generate());
  }
}
