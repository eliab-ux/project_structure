import { DomainException } from '@gitspread/domain-primitives';

/**
 * Uma exceção só para todos os motivos de recusa — código errado, expirado, já usado, tentativas
 * esgotadas, conta inexistente. Distinguir os casos na resposta contaria a um atacante se o
 * e-mail existe e se o código já foi gerado; a diferença fica no log interno.
 */
export class InvalidResetCodeException extends DomainException {
  constructor() {
    super('Código inválido ou expirado. Solicite um novo código.');
  }
}
