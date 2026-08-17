import { DomainException } from '@gitspread/domain-primitives';

/**
 * Violação de invariante de um Value Object. Vira 400 no GlobalExceptionFilter.
 *
 * A mensagem é escrita para o usuário final e **nunca** ecoa o valor recusado: um VO recusa
 * e-mail, telefone e senha, e repetir o valor na mensagem o coloca no log de acesso, no relatório
 * de erro e na tela — exatamente onde dado pessoal não deve estar.
 */
export class InvalidValueException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
