import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class UserId extends UuidId {
  static from(value: string): UserId {
    return new UserId(UuidId.parse(value, 'Identificador do usuário'));
  }

  static create(): UserId {
    return new UserId(UuidId.generate());
  }
}
