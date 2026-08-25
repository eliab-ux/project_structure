import { DomainException } from '@gitspread/domain-primitives';

export class CannotDisableSelfException extends DomainException {
  constructor() {
    super('Você não pode desativar o próprio usuário.');
  }
}
