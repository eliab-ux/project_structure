import { DomainException } from '@gitspread/domain-primitives';

/**
 * Impede a conta de ficar sem ninguém capaz de administrá-la. Vira 400 — é regra de negócio, não
 * falta de permissão: quem tentou tinha o direito, o que não existe é a operação.
 */
export class LastOwnerException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
