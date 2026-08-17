import { DomainException } from '@gitspread/domain-primitives';

/**
 * Vira 401 (o nome casa com /InvalidCredentials/).
 *
 * Uma única exceção para os três motivos — e-mail inexistente, senha errada, usuário inativo —
 * e a mesma mensagem para todos. Diferenciar diria a quem tenta se aquele e-mail existe na casa,
 * transformando a tela de login num verificador de quadro de funcionários.
 */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('E-mail ou senha inválidos.');
  }
}
