import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';

export const PASSWORD_RESET_NOTIFIER = Symbol('PASSWORD_RESET_NOTIFIER');

export interface PasswordResetMessage {
  to: PhoneE164;
  name: string;
  code: string;
  expiresInMinutes: number;
}

export interface PasswordResetNotifierPort {
  /**
   * O canal está configurado e pronto para enviar?
   *
   * Consultado ANTES de procurar o usuário, e essa ordem é a regra (CLAUDE.md). Se o canal só
   * falhasse na hora do envio, um e-mail real produziria erro e um e-mail inexistente responderia
   * 204 — entregando de bandeja quais contas existem.
   */
  isConfigured(): boolean;

  /** Lança em falha de envio. O CÓDIGO jamais entra em log, nem em erro. */
  send(message: PasswordResetMessage): Promise<void>;
}
