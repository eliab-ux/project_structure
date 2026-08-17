import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

/**
 * Identificador da conta — a chave de isolamento multiconta. Sempre vem do JWT, **nunca** do body
 * ou da query (spec §0.6).
 */
export class AccountId extends UuidId {
  static from(value: string): AccountId {
    return new AccountId(UuidId.parse(value, 'Identificador da conta'));
  }

  static create(): AccountId {
    return new AccountId(UuidId.generate());
  }
}
