import { DomainException } from '@gitspread/domain-primitives';

/** Vira 404 no GlobalExceptionFilter (o nome casa com /NotFound/). */
export class AccountNotFoundException extends DomainException {
  constructor() {
    // Sem o id na mensagem: quem pergunta já sabe qual conta é a dele (vem do token), e para
    // quem não sabe, confirmar a existência de um id é informação que não deve sair daqui.
    super('Conta não encontrada.');
  }
}
