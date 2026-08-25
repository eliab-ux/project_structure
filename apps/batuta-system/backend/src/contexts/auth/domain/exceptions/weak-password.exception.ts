import { DomainException } from '@gitspread/domain-primitives';

export class WeakPasswordException extends DomainException {
  constructor() {
    super('Senha deve ter no mínimo 10 caracteres, com letras e números.');
  }
}
