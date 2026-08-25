import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    // Mensagem genérica (não revela se o e-mail existe) — GlobalExceptionFilter → 401.
    super('E-mail e/ou senha incorreto(s).');
  }
}

export class EmailNotVerifiedException extends DomainException {
  constructor() {
    super('E-mail não verificado. Verifique sua caixa de entrada.');
  }
}
