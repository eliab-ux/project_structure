import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class PasswordResetCodeId extends UuidId {
  static from(value: string): PasswordResetCodeId {
    return new PasswordResetCodeId(UuidId.parse(value, 'Identificador do código'));
  }

  static create(): PasswordResetCodeId {
    return new PasswordResetCodeId(UuidId.generate());
  }
}
