import { DomainException } from '@gitspread/domain-primitives';

/**
 * O canal que fala com o usuário (WhatsApp de suporte) não está utilizável — tipicamente
 * configuração ausente no ambiente.
 *
 * É levantada **antes** de qualquer consulta ao usuário, de propósito: se fosse depois, a
 * recuperação responderia 200 para e-mail inexistente e erro para e-mail real, e a tela viraria
 * um verificador de contas cadastradas. Assim o erro é idêntico para todo mundo.
 *
 * O sufixo `Unavailable` é o que o GlobalExceptionFilter traduz em 503 — "indisponível agora",
 * que é a verdade: não é erro do usuário e repetir já não resolve.
 */
export class SupportChannelUnavailableException extends DomainException {
  constructor() {
    super('Recuperação de senha indisponível no momento. Tente novamente mais tarde.');
  }
}
