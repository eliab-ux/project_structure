import { DomainException } from '@gitspread/domain-primitives';

/**
 * A ÚNICA exceção do fluxo de recuperação de senha. Vira 400.
 *
 * Código inexistente, expirado, já usado, tentativas esgotadas, código errado: todos levantam
 * esta, com esta mensagem. A regra vem do CLAUDE.md e o motivo é oráculo de enumeração — se
 * "código expirado" e "código inválido" fossem respostas distintas, bastaria observar qual delas
 * volta para descobrir se existe um pedido em aberto para aquele e-mail.
 *
 * Pelo mesmo motivo o PEDIDO de código (`request-password-reset`) não levanta exceção nenhuma:
 * responde igual para e-mail existente e inexistente.
 */
export class PasswordResetUnavailableException extends DomainException {
  constructor() {
    super('Código inválido ou expirado. Solicite um novo código.');
  }
}
