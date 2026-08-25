import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    // Genérica de propósito — nunca revelar se o e-mail existe (anti-enumeração).
    super('Credenciais inválidas');
  }
}
